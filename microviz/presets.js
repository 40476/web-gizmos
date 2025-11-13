const presets = {
            waveform: {
                displayName: "Waveform",
                settings: [
                    { id: 'lineWidth', type: 'range', label: 'Line Width', min: 1, max: 10, default: 2 },
                    { id: 'color', type: 'color', label: 'Color', default: '#00ff9d' }
                ],
                draw: () => {
                  return () => {
                    const thisConfig = CONFIG.settings.waveform;
                    ctx.lineWidth = thisConfig.lineWidth;
                    ctx.strokeStyle = thisConfig.color;
                    ctx.beginPath();
                    
                    const sliceWidth = canvas.width / audioData.length;
                    let x = 0;
                    
                    for (let i = 0; i < audioData.length; i++) {
                        const v = audioData[i] / 128.0;
                        const y = v * canvas.height / 2;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        
                        x += sliceWidth;
                    }
                    
                    ctx.lineTo(canvas.width, canvas.height / 2);
                    ctx.stroke();
                  }
                }
            },

            circular: {
                displayName: "Circle",
                settings: [
                    { id: 'ringBarCount', type: 'range', label: 'Bar Count', min: 16, max: 256, step: 1, default: 128 },
                    { id: 'color', type: 'color', label: 'Color', default: '#00ff9d' }
                ],
                draw: () => {
                  return () => {
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const radius = Math.min(canvas.width, canvas.height) * 0.25;
                    const thisConfig = CONFIG.settings.circular;
                    
                    ctx.strokeStyle = thisConfig.color;
                    ctx.lineWidth = 3;
                    
                    for (let i = 0; i < thisConfig.ringBarCount; i++) {
                        const value = audioData[i];
                        const length = (value / 255) * radius * CONFIG.master.sensitivity;
                        const angle = (i * 2 * Math.PI) / thisConfig.ringBarCount;
                        
                        const x1 = centerX + Math.cos(angle) * radius;
                        const y1 = centerY + Math.sin(angle) * radius;
                        const x2 = centerX + Math.cos(angle) * (radius + length);
                        const y2 = centerY + Math.sin(angle) * (radius + length);
                        
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                  }
                }
            },
            
            liquid: {
                displayName: "Liquid",
                settings: [
                    { id: 'smoothness', type: 'range', label: 'Smoothness', min: 0.1, max: 1.0, step: 0.1, default: 0.5 },
                    { id: 'elasticity', type: 'range', label: 'Elasticity', min: 0.5, max: 2.0, step: 0.1, default: 1.2 },
                    { id: 'color', type: 'color', label: 'Color', default: '#00ff9d' }
                ],
                draw: () => {
                    
                    
                    
                  return () => {
                  const points = Array(20).fill().map(() => ({
                        angle: 0,
                        radius: 0,
                        targetRadius: 0
                    }));
                        const centerX = canvas.width / 2;
                        const centerY = canvas.height / 2;
                        const baseRadius = Math.min(canvas.width, canvas.height) * 0.2;
                        const thisConfig = CONFIG.settings.liquid;
                        
                        // Audio reactivity
                        const frequencyData = new Float32Array(analyser.frequencyBinCount);
                        analyser.getFloatFrequencyData(frequencyData);
                        
                        ctx.fillStyle = thisConfig.color;
                        ctx.beginPath();
                        
                        points.forEach((point, i) => {
                            const audioValue = Math.max(0, frequencyData[Math.floor(i * 4)] + 100) / 100;
                            point.targetRadius = baseRadius * (1 + audioValue * thisConfig.elasticity);
                            
                            // Smooth transition
                            point.radius += (point.targetRadius - point.radius) * thisConfig.smoothness;
                            point.angle = (i / points.length) * Math.PI * 2;
                            
                            const x = centerX + Math.cos(point.angle) * point.radius;
                            const y = centerY + Math.sin(point.angle) * point.radius;
                            
                            if (i === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.quadraticCurveTo(
                                    centerX + Math.cos(point.angle - 0.1) * point.radius * 0.9,
                                    centerY + Math.sin(point.angle - 0.1) * point.radius * 0.9,
                                    x,
                                    y
                                );
                            }
                        });
                        
                        ctx.closePath();
                        ctx.fill();
                        
                  }
                    
                }
            },
            
            gradientBars: {
                displayName: "Gradient Bars",
                settings: [
                    { id: 'barCount', type: 'range', label: 'Bar Count', min: 16, max: 256, step: 1, default: 128 },
                    { id: 'gradStart', type: 'color', label: 'Gradient Start', default: '#00ff9d' },
                    { id: 'gradEnd', type: 'color', label: 'Gradient End', default: '#ff00ff' },
                    { id: 'gradDirection', type: 'select', label: 'Direction', options: ['vertical', 'horizontal'], default: 'vertical' }
                ],
                draw: () => {
                  return () => {
                const thisConfig = CONFIG.settings.gradientBars;
                    const barWidth = canvas.width / thisConfig.barCount;
                    const gradient = thisConfig.gradDirection === 'vertical' 
                        ? ctx.createLinearGradient(0, 0, 0, canvas.height)
                        : ctx.createLinearGradient(0, 0, canvas.width, 0);
                        
                    gradient.addColorStop(0, thisConfig.gradStart);
                    gradient.addColorStop(1, thisConfig.gradEnd);
                    
                    ctx.fillStyle = gradient;
                    
                    for (let i = 0; i < thisConfig.barCount; i++) {
                        const value = audioData[i];
                        const barHeight = (value / 255) * canvas.height * CONFIG.master.sensitivity;
                        const x = i * barWidth;
                        const y = canvas.height - barHeight;
                        
                        ctx.fillRect(x, y, barWidth - 2, barHeight);
                    }
                  }
                }
            },

            waveRings: {
                displayName: "Wave Rings",
                settings: [
                    { id: 'ringCount', type: 'range', label: 'Ring Count', min: 3, max: 20, step: 1, default: 8 },
                    { id: 'ringThickness', type: 'range', label: 'Thickness', min: 1, max: 20, default: 3 },
                    { id: 'color', type: 'color', label: 'Color', default: "#00ff9d" }
                ],
                draw: () => {
                  return () => {
                    const thisConfig = CONFIG.settings.waveRings;
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
                    
                    ctx.strokeStyle = thisConfig.color;
                    ctx.lineWidth = thisConfig.ringThickness;
                    
                    for (let i = 0; i < thisConfig.ringCount; i++) {
                        const audioValue = audioData[Math.floor(i * (audioData.length / thisConfig.ringCount))];
                        const amplitude = audioValue / 255;
                        const ringRadius = maxRadius * (i / thisConfig.ringCount) * (1 + amplitude * CONFIG.master.sensitivity);
                        
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                  }
                }
            },

            sphere: {
                displayName: "Sphere",
                settings: [
                    { id: 'sphereSize', type: 'range', label: 'Size', min: 50, max: 300, default: 150 },
                    { id: 'rotSpeed', type: 'range', label: 'Rotation', min: 0, max: 2, step: 0.1, default: 0.5 },
                    { id: 'color', type: 'color', label: 'Color', default: '#00ff9d' }
                ],
                draw: () => {                    
                    return () => {
                        const thisConfig = CONFIG.settings.sphere;
                        let rotation = 0;
                        const centerX = canvas.width / 2;
                        const centerY = canvas.height / 2;
                        const radius = thisConfig.sphereSize;
                        
                        rotation += thisConfig.rotSpeed;
                        
                        ctx.strokeStyle = thisConfig.color;
                        ctx.beginPath();
                        
                        for (let i = 0; i < 32; i++) {
                            const audioValue = audioData[Math.floor(i * (audioData.length / 32))];
                            const depth = 1 + (audioValue / 255) * CONFIG.master.sensitivity;
                            
                            // Horizontal bands
                            const latAngle = i * (Math.PI / 16) - Math.PI/2;
                            const y = centerY + radius * Math.sin(latAngle);
                            const bandRadius = Math.cos(latAngle) * radius * depth;
                            
                            // Vertical bands
                            const lonAngle = i * (Math.PI / 16) + rotation;
                            const x = centerX + bandRadius * Math.cos(lonAngle);
                            const y2 = centerY + bandRadius * Math.sin(lonAngle);
                            
                            ctx.lineTo(x, y);
                            ctx.lineTo(x, y2);
                        }
                        
                        ctx.closePath();
                        ctx.stroke();
                    };
                    
                }
            },
            starburst: {
    displayName: "Starburst",
    settings: [
        { id: 'rayCount', type: 'range', label: 'Ray Count', min: 32, max: 512, default: 128 },
        { id: 'maxLength', type: 'range', label: 'Max Length', min: 50, max: 300, default: 200 },
        { id: 'baseColor', type: 'color', label: 'Base Color', default: '#00ff9d' },
        { id: 'pulseResponse', type: 'range', label: 'Pulse Response', min: 0.5, max: 3.0, step: 0.1, default: 1.5 }
    ],
    draw: () => {
        return () => {
            const thisConfig = CONFIG.settings.starburst;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            ctx.strokeStyle = thisConfig.baseColor;
            
            for (let i = 0; i < thisConfig.rayCount; i++) {
                const frequencyIndex = Math.floor(i * (audioData.length / thisConfig.rayCount));
                const audioValue = audioData[frequencyIndex];
                const intensity = audioValue / 255 * thisConfig.pulseResponse * CONFIG.master.sensitivity;
                const angle = (i / thisConfig.rayCount) * Math.PI * 2;
                
                const endX = centerX + Math.cos(angle) * thisConfig.maxLength * intensity;
                const endY = centerY + Math.sin(angle) * thisConfig.maxLength * intensity;
                
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
},
fireMatrix: {
    displayName: "Fire Matrix",
    settings: [
        { id: 'cellSize', type: 'range', label: 'Cell Size', min: 4, max: 20, default: 8 },
        { id: 'fireHeight', type: 'range', label: 'Fire Height', min: 10, max: 100, default: 50 },
        { id: 'color1', type: 'color', label: 'Base Color', default: '#ff9900' },
        { id: 'color2', type: 'color', label: 'Tip Color', default: '#ffff00' }
    ],
    draw: () => {
        return () => {
            const thisConfig = CONFIG.settings.fireMatrix;
            const cols = Math.ceil(canvas.width / thisConfig.cellSize);
            const rows = Math.ceil(thisConfig.fireHeight);
            
            const gradient = ctx.createLinearGradient(0, 0, 0, thisConfig.fireHeight * thisConfig.cellSize);
            gradient.addColorStop(0, thisConfig.color1);
            gradient.addColorStop(1, thisConfig.color2);
            
            for (let x = 0; x < cols; x++) {
                const amplitude = audioData[Math.floor(x * (audioData.length / cols))] / 255;
                const flameHeight = rows * amplitude * CONFIG.master.sensitivity;
                
                for (let y = 0; y < rows; y++) {
                    const brightness = Math.max(0, 1 - (y / flameHeight));
                    ctx.fillStyle = brightness > 0.3 ? gradient : '#000000';
                    
                    if (y < flameHeight) {
                        ctx.fillRect(
                            x * thisConfig.cellSize,
                            canvas.height - y * thisConfig.cellSize,
                            thisConfig.cellSize - 1,
                            thisConfig.cellSize - 1
                        );
                    }
                }
            }
        }
    }
},
gravityVortex: {
    displayName: "Gravity Vortex",
    settings: [
        { id: 'particleCount', type: 'range', label: 'Particles', min: 50, max: 5000, default: 1000 },
        { id: 'rotationSpeed', type: 'range', label: 'Rotation Speed', min: 0.1, max: 5.0, step: 0.1, default: 1.5 },
        { id: 'color', type: 'color', label: 'Color', default: '#00ffff' }
    ],
    draw: () => {
        let particles = [];
        let rotation = 0;
        
        return () => {
            const thisConfig = CONFIG.settings.gravityVortex;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const baseRadius = Math.min(canvas.width, canvas.height) * 0.3;
            
            // Initialize particles
            if (particles.length === 0) {
                for (let i = 0; i < thisConfig.particleCount; i++) {
                    particles.push({
                        angle: Math.PI * 2 * Math.random(),
                        radius: baseRadius * Math.random(),
                        speed: 0.5 + Math.random() * 2
                    });
                }
            }
            
            rotation += thisConfig.rotationSpeed * 0.01;
            const audioPeak = Math.max(...audioData) / 255 * 3;
            
            ctx.fillStyle = thisConfig.color;
            
            particles.forEach((p, i) => {
                const audioInfluence = audioData[Math.floor(i * (audioData.length / thisConfig.particleCount))] / 255;
                p.radius = Math.max(10, baseRadius * (1 - 0.5 * audioInfluence * CONFIG.master.sensitivity));
                p.angle += (0.01 * p.speed * audioPeak * thisConfig.rotationSpeed) % (Math.PI * 2);
                
                const x = centerX + Math.cos(p.angle + rotation) * p.radius;
                const y = centerY + Math.sin(p.angle + rotation) * p.radius;
                
                ctx.beginPath();
                ctx.arc(x, y, 1 + (audioInfluence * 3), 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }
},
harmonicRings: {
    displayName: "Harmonic Rings",
    settings: [
        { id: 'ringCount', type: 'range', label: 'Rings', min: 3, max: 20, default: 8 },
        { id: 'maxRadius', type: 'range', label: 'Max Size', min: 50, max: 400, default: 200 },
        { id: 'waveCount', type: 'range', label: 'Waves', min: 1, max: 10, default: 3 },
        { id: 'color', type: 'color', label: 'Color', default: '#00ff9d' }
    ],
    draw: () => {
        return () => {
            const thisConfig = CONFIG.settings.harmonicRings;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            ctx.strokeStyle = thisConfig.color;
            
            for (let i = 0; i < thisConfig.ringCount; i++) {
                const ringSize = thisConfig.maxRadius * (i / thisConfig.ringCount);
                const audioIndex = Math.floor(i * (audioData.length / thisConfig.ringCount));
                const amplitude = audioData[audioIndex] / 255 * CONFIG.master.sensitivity;
                
                ctx.beginPath();
                for (let a = 0; a < Math.PI * 2; a += 0.01) {
                    const ripple = Math.sin(a * thisConfig.waveCount) * ringSize * 0.2 * amplitude;
                    const x = centerX + Math.cos(a) * (ringSize + ripple);
                    const y = centerY + Math.sin(a) * (ringSize + ripple);
                    ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }
},
spectralFlower: {
    displayName: "Spectral Flower",
    settings: [
        { id: 'petalCount', type: 'range', label: 'Petals', min: 4, max: 32, default: 8 },
        { id: 'bloomFactor', type: 'range', label: 'Bloom', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
        { id: 'innerColor', type: 'color', label: 'Inner Color', default: '#ff00ff' },
        { id: 'outerColor', type: 'color', label: 'Outer Color', default: '#00ff9d' }
    ],
    draw: () => {
        return () => {
            const thisConfig = CONFIG.settings.spectralFlower;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

            const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, maxRadius);
            gradient.addColorStop(0, thisConfig.innerColor);
            gradient.addColorStop(1, thisConfig.outerColor);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            
            for (let i = 0; i < thisConfig.petalCount; i++) {
                const audioValue = audioData[Math.floor(i * (audioData.length / thisConfig.petalCount))];
                const intensity = (audioValue / 255) * CONFIG.master.sensitivity * thisConfig.bloomFactor;
                
                const angle = (i / thisConfig.petalCount) * Math.PI * 2;
                const nextAngle = ((i+1) % thisConfig.petalCount) / thisConfig.petalCount * Math.PI * 2;
                
                // Control points create petal shape
                const cp1x = centerX + Math.cos(angle) * maxRadius * intensity * 1.3;
                const cp1y = centerY + Math.sin(angle) * maxRadius * intensity * 1.3;
                const cp2x = centerX + Math.cos(nextAngle) * maxRadius * intensity * 1.3;
                const cp2y = centerY + Math.sin(nextAngle) * maxRadius * intensity * 1.3;
                
                if (i === 0) {
                    ctx.moveTo(
                        centerX + Math.cos(angle) * maxRadius * intensity,
                        centerY + Math.sin(angle) * maxRadius * intensity
                    );
                }
                
                ctx.bezierCurveTo(
                    cp1x, cp1y,
                    cp2x, cp2y,
                    centerX + Math.cos(nextAngle) * maxRadius * intensity,
                    centerY + Math.sin(nextAngle) * maxRadius * intensity
                );
            }
            
            ctx.closePath();
            ctx.fill();
        }
    }
},
vectorField: {
    displayName: "Vector Field",
    settings: [
        { id: 'gridSize', type: 'range', label: 'Grid Density', min: 10, max: 50, default: 25 },
        { id: 'lineLength', type: 'range', label: 'Line Scale', min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
        { id: 'harmonicScale', type: 'range', label: 'Harmonics', min: 1, max: 10, default: 3 },
        { id: 'color', type: 'color', label: 'Line Color', default: '#00ff9d' }
    ],
    draw: () => {
        return () => {
            const thisConfig = CONFIG.settings.vectorField;
            const cellSize = canvas.width / thisConfig.gridSize;
            const time = Date.now() * 0.001;
            
            ctx.strokeStyle = thisConfig.color;
            ctx.lineWidth = 1;
            
            for (let x = 0; x < thisConfig.gridSize; x++) {
                for (let y = 0; y < thisConfig.gridSize; y++) {
                    const screenX = x * cellSize;
                    const screenY = y * cellSize;
                    const audioIndex = Math.floor((x + y * thisConfig.gridSize) * (audioData.length / (thisConfig.gridSize * thisConfig.gridSize)));
                    
                    // Create field using multiple harmonics
                    const angle = 
                        Math.sin(screenX * 0.01 * thisConfig.harmonicScale + time) * 1.5 +
                        Math.cos(screenY * 0.01 * thisConfig.harmonicScale + time) * 1.5 +
                        (audioData[audioIndex] / 255) * CONFIG.master.sensitivity * 3;
                    
                    const lineLength = cellSize * 0.4 * thisConfig.lineLength;
                    const endX = screenX + Math.cos(angle) * lineLength;
                    const endY = screenY + Math.sin(angle) * lineLength;
                    
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
            }
        }
    }
},
neonTrails: {
    displayName: "Neon Trails",
    settings: [
        { id: 'trailLength', type: 'range', label: 'Trail Length', min: 10, max: 100, default: 30 },
        { id: 'dotCount', type: 'range', label: 'Dot Count', min: 10, max: 100, default: 40 },
        { id: 'baseHue', type: 'range', label: 'Base Hue', min: 0, max: 359, default: 120 },
        { id: 'spread', type: 'range', label: 'Spread', min: 0.5, max: 5.0, step: 0.1, default: 1.5 }
    ],
    draw: () => {
        // Persistent data object
        const dots = Array.from({ length: 30 }, () => ({
            xHistory: Array(30).fill(0),
            yHistory: Array(30).fill(0),
            currentX: 0,
            currentY: 0
        }));
        
        return () => {
            const thisConfig = CONFIG.settings.neonTrails;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const baseRadius = Math.min(canvas.width, canvas.height) * 0.4;
            const time = Date.now() * 0.001;
            
            ctx.globalCompositeOperation = 'lighten';
            
            // Update dot positions
            dots.forEach((dot, i) => {
                const angle = time + (i / dots.length) * Math.PI * 2 + (audioData[i] / 255) * CONFIG.master.sensitivity;
                const audioRadius = baseRadius * (1 + (audioData[Math.floor(i * 1.5)] / 255) * thisConfig.spread);
                
                // Store new position at head of history
                dot.xHistory.unshift(centerX + Math.cos(angle) * audioRadius);
                dot.yHistory.unshift(centerY + Math.sin(angle) * audioRadius);
                dot.xHistory.pop();
                dot.yHistory.pop();
            });
            
            // Draw trails with fading gradient
            dots.forEach((dot, i) => {
                const hue = (thisConfig.baseHue + i * 5) % 360;
                
                for (let j = 0; j < thisConfig.trailLength - 1; j++) {
                    const alpha = 1 - (j / thisConfig.trailLength);
                    ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha * 0.7})`;
                    ctx.lineWidth = 3 * alpha;
                    
                    ctx.beginPath();
                    ctx.moveTo(dot.xHistory[j], dot.yHistory[j]);
                    ctx.lineTo(dot.xHistory[j+1], dot.yHistory[j+1]);
                    ctx.stroke();
                }
            });
            
            ctx.globalCompositeOperation = 'source-over';
        }
    }
},
geometryPulse: {
    displayName: "Geometry Pulse",
    settings: [
        { id: 'shape', type: 'select', label: 'Shape', options: ['triangle', 'square', 'pentagon', 'hexagon'], default: 'triangle' },
        { id: 'layers', type: 'range', label: 'Layers', min: 3, max: 20, default: 8 },
        { id: 'warpFactor', type: 'range', label: 'Warp', min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
        { id: 'hueShift', type: 'range', label: 'Hue Shift', min: 0, max: 360, default: 0 },
        { id: 'hueShiftByAmplitude', type: 'range', label: 'Reactive Hue', min: 0, max: 360, default: 0 }
        
    ],
    draw: () => {
        let hue = 0;
        
        return () => {
            const thisConfig = CONFIG.settings.geometryPulse;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxSize = Math.min(canvas.width, canvas.height) * 0.4;
            const time = Date.now() * 0.001;
            
            hue = (hue + thisConfig.hueShift) % 360;
            
            // Determine number of sides based on shape
            const sides = {
                triangle: 3,
                square: 4,
                pentagon: 5,
                hexagon: 6
            }[thisConfig.shape] || 3;
            
            ctx.lineWidth = 2;
            
            // Draw concentric shapes
            for (let i = 0; i < thisConfig.layers; i++) {
                const audioValue = audioData[Math.floor(i * (audioData.length / thisConfig.layers))];
                const intensity = (audioValue / 255) * CONFIG.master.sensitivity;
                const size = maxSize * (i / thisConfig.layers) * (1 + intensity);
                const pulse = Math.sin(time + i * 0.5) * thisConfig.warpFactor;
                
                ctx.strokeStyle = `hsl(${hue + i*15+(intensity*thisConfig.hueShiftByAmplitude)}, 100%, ${50 + intensity*50}%)`;
                ctx.beginPath();
                
                for (let j = 0; j < sides; j++) {
                    const angle = (j / sides) * Math.PI * 2 + pulse;
                    const x = centerX + Math.cos(angle) * size;
                    const y = centerY + Math.sin(angle) * size;
                    
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                
                ctx.closePath();
                ctx.stroke();
            }
        }
    }
},
  vaporwaveDrive : {
  displayName: "Vaporwave Drive",
  settings: [
    { id: 'gridColor', type: 'color', label: 'Grid Color', default: '#a600ff' },
    { id: 'sunColorTop', type: 'color', label: 'Sun Gradient Top', default: '#ffff00' },
    { id: 'sunColorBottom', type: 'color', label: 'Sun Gradient Bottom', default: '#ff6600' },
    { id: 'barColor', type: 'color', label: 'Bar Color', default: '#6400c8' },
    { id: 'bgTop', type: 'color', label: 'BG Gradient Top', default: '#000000' },
    { id: 'bgBottom', type: 'color', label: 'BG Gradient Bottom', default: '#00007a' }, // im a bottom >w<
    { id: 'horizontalLines', type: 'range', label: 'Horizontal Bars', min: 0, max: 60, default: 2 },
    { id: 'columns', type: 'range', label: 'Columns', min: 1, max: 30, default: 9 },
    { id: 'lineSpeed', type: 'range', label: 'Horizontal Bar Speed', min: 0.1, max: 5, step: 0.1, default: 1.7 },
    { id: 'realisticDepth', type: 'select', label: 'Realistic Depth', options: ['on', 'off'], default: 'on' },
    { id: 'speedMultiplier', type: 'range', label: 'Realistic Depth Multiplier', min: 1, max: 6, step: 0.05, default: 3 },
    { id: 'RoadWidth', type: 'range', label: 'Road Width', min: 0.01, max: 1, step: 0.01, default: 1 },
    { id: 'sunStripes', type: 'range', label: 'Sun Stripes', min: 1, max: 50, default: 9 },
    { id: 'sunStripeThickness', type: 'range', label: 'Max Stripe Thickness', min: 1, max: 20, default: 8 },


  ],
  draw: () => {
    return () => {
      const cfg = CONFIG.settings.vaporwaveDrive;
      const w = canvas.width;
      const h = canvas.height;
      const roadHalfWidth = (w/2) * cfg.RoadWidth;

      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, cfg.bgTop); // top color
      gradient.addColorStop(1, cfg.bgBottom); // bottom color
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const horizonY = h/2;
      const columns = cfg.columns;
      // Bars inside road lanes
      analyser.getByteFrequencyData(audioData);
      ctx.fillStyle = cfg.barColor;

      for (let i = 0; i < columns; i++) {
        const value = audioData[i % audioData.length];
        const barHeight = (value / 255) * (h - horizonY) * CONFIG.master.sensitivity;

        // Road lane trapezoid boundaries
        const xBottomLeft  = w/2 - roadHalfWidth + (i/columns) * (roadHalfWidth * 2);
        const xBottomRight = w/2 - roadHalfWidth + ((i+1)/columns) * (roadHalfWidth * 2);
        const xTop = w/2; // all converge at horizon center

        // Interpolate lane edges at bar top
        const yTop = h - barHeight;
        const t = (h - yTop) / (h - horizonY); // 0 at bottom, 1 at horizon
        const xLeft = xBottomLeft + t * (xTop - xBottomLeft);
        const xRight = xBottomRight + t * (xTop - xBottomRight);

        // Draw bar polygon inside trapezoid
        ctx.beginPath();
        ctx.moveTo(xBottomLeft, h);
        ctx.lineTo(xBottomRight, h);
        ctx.lineTo(xRight, yTop);
        ctx.lineTo(xLeft, yTop);
        ctx.closePath();
        ctx.fill();
      }

      // Draw grid lines first
      ctx.strokeStyle = cfg.gridColor;
      ctx.lineWidth = 2;
      
      // Vertical perspective lines
      ctx.beginPath();
      for (let i = 0; i <= columns; i++) {
        const x = w/2 - roadHalfWidth + (i/columns) * (roadHalfWidth * 2);
        ctx.moveTo(x, h);
        ctx.lineTo(w/2, horizonY);
      }
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      for (let i = 0; i < cfg.horizontalLines; i++) {
        // what the heck
        let norm = ((i + (Date.now()/1000) * cfg.lineSpeed) % cfg.horizontalLines) / cfg.horizontalLines;
        let y = mapRange(norm, 0, 1, horizonY, h);

        if (cfg.realisticDepth === 'on') {
          // this is wack. so wack.
          y = horizonY + (h - horizonY) *  Math.pow(norm, cfg.speedMultiplier);
          // use this for dumping to a csv
          // norm,horizonY,h,y
          // console.log(`${norm}, ${horizonY}, ${h}, ${y}`);
        }

        // road edges at this y
        const t = (y - horizonY) / (h - horizonY);
        const xLeft  = (1 - t) * (w/2) + t * (w/2 - roadHalfWidth);
        const xRight = (1 - t) * (w/2) + t * (w/2 + roadHalfWidth);
        ctx.moveTo(xLeft, y);
        ctx.lineTo(xRight, y);
      }
      ctx.stroke();
      
      const sunGradient = ctx.createLinearGradient(0, h/3 - h/6, 0, h/3 + h/6);
      sunGradient.addColorStop(0, cfg.sunColorTop);
      sunGradient.addColorStop(1, cfg.sunColorBottom);

      // Draw the sun gradient first
      ctx.fillStyle = sunGradient;
      ctx.beginPath();
      ctx.arc(w/2, h/3, h/6, 0, Math.PI * 2);
      ctx.fill();

      // Now clip to the sun’s circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(w/2, h/3, h/6, 0, Math.PI * 2);
      ctx.clip();

      // Clear out stripes so background shows through
      for (let i = 0; i < cfg.sunStripes; i++) {
        const stripeHeight = cfg.sunStripeThickness; // or from config
        const y = h/3 + h/6 - i * (stripeHeight * 2);
        ctx.clearRect(w/2 - h/6, y, h/3, stripeHeight-(i));
      }

      ctx.restore();

    };
  }
}
};