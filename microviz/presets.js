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
                    
                    const sliceWidth = canvas2D.width / audioData.length;
                    let x = 0;
                    
                    for (let i = 0; i < audioData.length; i++) {
                        const v = audioData[i] / 128.0;
                        const y = v * canvas2D.height / 2;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        
                        x += sliceWidth;
                    }
                    
                    ctx.lineTo(canvas2D.width, canvas2D.height / 2);
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
                    const centerX = canvas2D.width / 2;
                    const centerY = canvas2D.height / 2;
                    const radius = Math.min(canvas2D.width, canvas2D.height) * 0.25;
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
                        const centerX = canvas2D.width / 2;
                        const centerY = canvas2D.height / 2;
                        const baseRadius = Math.min(canvas2D.width, canvas2D.height) * 0.2;
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
                    const barWidth = canvas2D.width / thisConfig.barCount;
                    const gradient = thisConfig.gradDirection === 'vertical' 
                        ? ctx.createLinearGradient(0, 0, 0, canvas2D.height)
                        : ctx.createLinearGradient(0, 0, canvas2D.width, 0);
                        
                    gradient.addColorStop(0, thisConfig.gradStart);
                    gradient.addColorStop(1, thisConfig.gradEnd);
                    
                    ctx.fillStyle = gradient;
                    
                    for (let i = 0; i < thisConfig.barCount; i++) {
                        const value = audioData[i];
                        const barHeight = (value / 255) * canvas2D.height * CONFIG.master.sensitivity;
                        const x = i * barWidth;
                        const y = canvas2D.height - barHeight;
                        
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
                    const centerX = canvas2D.width / 2;
                    const centerY = canvas2D.height / 2;
                    const maxRadius = Math.min(canvas2D.width, canvas2D.height) * 0.4;
                    
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
                        const centerX = canvas2D.width / 2;
                        const centerY = canvas2D.height / 2;
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            
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
            const cols = Math.ceil(canvas2D.width / thisConfig.cellSize);
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
                            canvas2D.height - y * thisConfig.cellSize,
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            const baseRadius = Math.min(canvas2D.width, canvas2D.height) * 0.3;
            
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            const maxRadius = Math.min(canvas2D.width, canvas2D.height) * 0.4;

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
            const cellSize = canvas2D.width / thisConfig.gridSize;
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            const baseRadius = Math.min(canvas2D.width, canvas2D.height) * 0.4;
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
            const centerX = canvas2D.width / 2;
            const centerY = canvas2D.height / 2;
            const maxSize = Math.min(canvas2D.width, canvas2D.height) * 0.4;
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
        { id: 'sunStripeThickness', type: 'range', label: 'Sun Stripe Thickness', min: 1, max: 20, default: 8 },


      ],
      draw: () => {
        return () => {
          const cfg = CONFIG.settings.vaporwaveDrive;
          const w = canvas2D.width;
          const h = canvas2D.height;
          const roadHalfWidth = (w/2) * cfg.RoadWidth;
          const gradient = ctx.createLinearGradient(0, 0, 0, h);
          
          gradient.addColorStop(0, cfg.bgTop); // top color
          gradient.addColorStop(1, cfg.bgBottom); // bottom color
          
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);

          const horizonY = h/2;
          const columns = cfg.columns;
          // Bars inside road lanes

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
    },
    fire : {
      displayName: "I broke copilot and it made this smh",
      settings: [
        { id: 'flameCount', type: 'range', label: 'Count', min: 16, max: 128, step: 1, default: 64 },
        { id: 'baseColor', type: 'color', label: 'Base Color', default: '#ff3300' },
        { id: 'tipColor', type: 'color', label: 'Tip Color', default: '#ffff99' },
        { id: 'noiseScale', type: 'range', label: 'Noise Scale', min: 0.1, max: 2, step: 0.1, default: 1 },
        { id: 'intensity', type: 'range', label: 'Intensity', min: 0.5, max: 3, step: 0.1, default: 1.5 }
      ],
      draw: () => {
        let frame = 0;
        return () => {
          const thisConfig = CONFIG.settings.fire;
          const flameWidth = canvas2D.width / thisConfig.flameCount;
          frame++;

          for (let i = 0; i < thisConfig.flameCount; i++) {
            const value = audioData[i % audioData.length];
            const audioFactor = (value / 255) * thisConfig.intensity;

            // Sequential seed: combine frame + index
            const seed = (Date.now() / 1000 + i + frame * 0.01) * thisConfig.noiseScale;

            // Fake noise: use Math.sin for demo (replace with real noise lib for smoother flames)
            const flicker = (Math.sin(seed) + 1) / 2; // 0–1
            const flameHeight = (flicker * canvas2D.height * 0.4) * audioFactor;

            const x = i * flameWidth;
            const y = canvas2D.height - flameHeight;

            const grad = ctx.createLinearGradient(x, y, x, canvas2D.height);
            grad.addColorStop(0, thisConfig.tipColor);
            grad.addColorStop(1, thisConfig.baseColor);

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, flameWidth, flameHeight);
          }
        };
      }
    },
    textReactive: {
      displayName: "Reactive Text",
      settings: [
        { id: 'text', type: 'text', label: 'Text', default: 'EMPLOYMENT' },
        { id: 'font', type: 'text', label: 'Font or URL', default: 'Impact' },
        { id: 'color', type: 'color', label: 'Color', default: '#00ff00' },
        { id: 'shakeIntensity', type: 'range', label: 'Shake Intensity', min: 0, max: 20, step: 1, default: 9 },
        { id: 'warpAmount', type: 'range', label: 'Warp Amount', min: 0, max: 1, step: 0.000001, default: 0.0507 },
        { id: 'scaleMultiplier', type: 'range', label: 'Scale Multiplier', min: 0, max: 1, step: 0.05, default: 0.8 }
      ],
      modules: [
          
      ],
      draw: () => {
        let angle = 0;
        let shakeMomentum = 0;
        let bassBaseline = 0;
        // Call once at init
        let loadedFont = CONFIG.settings.textReactive.font || "impact";

        return () => {
          const thisConfig = CONFIG.settings.textReactive;

          const bass = audioData.slice(0, 32).reduce((a,b)=>a+b,0) / 32;
          const mids = audioData.slice(32, 128).reduce((a,b)=>a+b,0) / 96;
          const highs = audioData.slice(128).reduce((a,b)=>a+b,0) / (audioData.length-128);
          
          
          // why? BECAUSE FIREFOX THATS WHY
          bassBaseline = (bassBaseline * 0.98 + bass * 0.02) * (bass !== 0 ? 1 : 0);
          const bassNorm = Math.pow((bass - bassBaseline) / 80,5);
          shakeMomentum = shakeMomentum * 0.85 + bassNorm * 0.15;
          
          const shakeX = (Math.random() - 0.5) * thisConfig.shakeIntensity * shakeMomentum * 4;
          const shakeY = (Math.random() - 0.5) * thisConfig.shakeIntensity * shakeMomentum * 4;
          
          angle += (highs/255);
          const warp = Math.pow(mids/255, 1.5) * thisConfig.warpAmount * 3;

          ctx.save();
          ctx.translate(canvas2D.width/2 + shakeX, canvas2D.height/2 + shakeY);
          ctx.rotate(angle);

          const scale = 1 + bassNorm * scaleMultiplier;
          ctx.scale(scale, scale);

          ctx.font = `${canvas2D.height * (0.1 + warp)}px ${loadedFont}`;
          ctx.fillStyle = thisConfig.color;
          ctx.textAlign = 'center';
          ctx.fillText(thisConfig.text, 0, 0);

          ctx.restore();
        };
      }
    },
    rainbowWaveGrid: {
  displayName: "Rainbow Wave Grid",
  settings: [
    { id: 'size', type: 'range', label: 'Diamond Size', min: 10, max: 80, step: 5, default: 30 },
    { id: 'spacing', type: 'range', label: 'Spacing', min: 0, max: 50, step: 1, default: 5 }
  ],
  modules: [],
  draw: () => {
    let hue = 0;
    return () => {
      const cfg = CONFIG.settings.rainbowWaveGrid;
      const mids = audioData.slice(32,128).reduce((a,b)=>a+b,0)/96;
      const highs = audioData.slice(128).reduce((a,b)=>a+b,0)/(audioData.length-128);
      const midsNorm = mids/255;
      const highsNorm = highs/255;

      hue = (hue+1)%360;

      ctx.save();
      ctx.clearRect(0,0,canvas2D.width,canvas2D.height);

      const step = cfg.size+cfg.spacing;
      const cols = Math.ceil(canvas2D.width/step)+2;
      const rows = Math.ceil(canvas2D.height/step)+2;

      for(let i=0;i<cols;i++){
        for(let j=0;j<rows;j++){
          const cx = i*step;
          const cy = j*step;

          const waveOffset = Math.sin((i+j+Date.now()/200)*0.5)*cfg.size*highsNorm;

          ctx.fillStyle = `hsl(${(hue+i*10+j*10)%360},100%,50%)`;
          ctx.beginPath();
          ctx.moveTo(cx, cy-waveOffset-cfg.size/2);
          ctx.lineTo(cx+cfg.size/2, cy-waveOffset);
          ctx.lineTo(cx, cy-waveOffset+cfg.size/2);
          ctx.lineTo(cx-cfg.size/2, cy-waveOffset);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    };
  }
},
diamondTunnel: {
  displayName: "Diamond Tunnel",
  settings: [
    { id: 'layers', type: 'range', label: 'Layers', min: 5, max: 50, step: 1, default: 20 },
    { id: 'size', type: 'range', label: 'Base Size', min: 20, max: 100, step: 5, default: 40 },
    { id: 'color', type: 'color', label: 'Color', default: '#ff6600' }
  ],
  modules: [],
  draw: () => {
    return () => {
      const cfg = CONFIG.settings.diamondTunnel;
      const highs = audioData.slice(128).reduce((a,b)=>a+b,0)/(audioData.length-128);
      const highsNorm = highs/255;

      ctx.save();
      ctx.clearRect(0,0,canvas2D.width,canvas2D.height);
      ctx.translate(canvas2D.width/2, canvas2D.height/2);

      for(let i=0;i<cfg.layers;i++){
        const scale = 1+i*0.1*(1+highsNorm);
        const s = cfg.size*scale;
        ctx.strokeStyle = cfg.color;
        ctx.beginPath();
        ctx.moveTo(0,-s/2);
        ctx.lineTo(s/2,0);
        ctx.lineTo(0,s/2);
        ctx.lineTo(-s/2,0);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    };
  }
},
dataStream:{
    displayName: "Data Stream",
    settings: [
        { id: 'color', type: 'color', label: 'Color', default: '#00ffff' },
        { id: 'glowColor', type: 'color', label: 'Glow Color', default: '#00ffff' },
        { id: 'numBars', type: 'range', label: 'Number of Bars', min: 10, max: 100, step: 2, default: 40 },
        { id: 'sensitivity', type: 'range', label: 'Sensitivity', min: 0.5, max: 3, step: 0.1, default: 1.5 },
        { id: 'scanlineOpacity', type: 'range', label: 'Scanline Opacity', min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { id: 'showParticles', type: 'checkbox', label: 'Show Particles', default: true },
        { id: 'showBrackets', type: 'checkbox', label: 'Show Brackets', default: true },
    ],
    modules: [
        { id: 'barcodeFont', url: 'https://fonts.gstatic.com/s/librebarcode39/v25/-nFnOHM08vwC6h8Li1eQnP_AHzI2G_Bx0g.woff2', type: 'font' },
    ],
    draw: (modules, store) => {
        // Persistent store for this visualizer
        if (!store.barValues) store.barValues = [];
        if (!store.scanlineY) store.scanlineY = 0;
        if (!store.particles) store.particles = [];
        
        const barcodeChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
        
        return () => {
            const config = CONFIG.settings.dataStream;
            const w = canvas2D.width;
            const h = canvas2D.height;
            
            const fontName = modules.barcodeFont || 'monospace';
            
            // Audio analysis
            const dataLen = audioData.length;
            const bass = audioData.slice(0, Math.floor(dataLen * 0.1)).reduce((a, b) => a + b, 0) / (dataLen * 0.1) / 255;
            const highs = audioData.slice(Math.floor(dataLen * 0.7), dataLen).reduce((a, b) => a + b, 0) / (dataLen * 0.3) / 255;
            
            // --- Draw ---
            
            // Fading background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, w, h);
            
            // Glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = config.glowColor;
            
            const barWidth = w / config.numBars;
            
            // Lazily fill store arrays
            if (store.barValues.length !== config.numBars) {
                store.barValues = new Array(config.numBars).fill(0);
            }
            
            ctx.font = `30px ${fontName}`;
            ctx.fillStyle = config.color;
            ctx.textAlign = 'center';
            
            // --- Draw Floor ---
            const floorY = h * 0.9;
            ctx.beginPath();
            ctx.moveTo(0, floorY);
            ctx.lineTo(w, floorY);
            ctx.strokeStyle = config.color;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
            
            for (let i = 0; i < config.numBars; i++) {
                // Get audio data for this bar
                const audioIndex = Math.floor(mapRange(i, 0, config.numBars, 0, audioData.length));
                const audioValue = (audioData[audioIndex] / 255) * config.sensitivity;
                
                // Use a simple smoothing equation
                let newHeight = audioValue * h * 0.7; // Max height is 70%
                store.barValues[i] = store.barValues[i] * 0.8 + newHeight * 0.2; // Lerp
                
                const x = i * barWidth + barWidth / 2;
                const yBase = floorY;
                
                if (store.barValues[i] < 10) continue; // Don't draw tiny bars
                
                // --- Add Particles ---
                if (config.showParticles && store.barValues[i] > h * 0.5 && Math.random() > 0.95) {
                    store.particles.push({
                        x: x,
                        y: yBase - store.barValues[i],
                        vx: (Math.random() - 0.5) * 2,
                                         vy: (Math.random() - 1) * 3,
                                         life: 1.0
                    });
                }
                
                // Generate a random barcode character
                const char = barcodeChars[Math.floor(Math.random() * barcodeChars.length)];
                
                // Draw the text repeatedly to create a "bar"
                ctx.save();
                ctx.translate(x, yBase);
                ctx.rotate(-Math.PI / 2); // Rotate text to be vertical
                
                // Glitch effect on highs
                const jitter = (highs > 0.8) ? (Math.random() - 0.5) * 10 : 0;
                
                // Vary opacity based on height
                ctx.globalAlpha = mapRange(store.barValues[i], 0, h * 0.7, 0.1, 1.0);
                
                // Draw text multiple times to form the bar
                for(let j = 0; j < store.barValues[i]; j += 20) {
                    ctx.fillText(char, j, jitter);
                }
                
                ctx.restore();
            }
            
            // --- Update and Draw Particles ---
            if (config.showParticles) {
                ctx.fillStyle = config.glowColor;
                ctx.shadowBlur = 5;
                ctx.shadowColor = config.glowColor;
                for (let i = store.particles.length - 1; i >= 0; i--) {
                    const p = store.particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.05; // gravity
                    p.life -= 0.02;
                    
                    if (p.life <= 0) {
                        store.particles.splice(i, 1);
                    } else {
                        ctx.globalAlpha = p.life;
                        ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
                    }
                }
                ctx.globalAlpha = 1.0;
            }
            
            // Draw scanline effect
            if (config.scanlineOpacity > 0) {
                store.scanlineY = (store.scanlineY + 0.5 + (bass * 2)) % h; // Move scanline, speed up with bass
                ctx.fillStyle = config.glowColor;
                ctx.globalAlpha = config.scanlineOpacity;
                ctx.shadowBlur = 0; // No glow for scanline
                ctx.fillRect(0, store.scanlineY, w, 2);
                ctx.globalAlpha = 1.0;
            }
            
            // --- Draw Corner Brackets ---
            if(config.showBrackets) {
                ctx.strokeStyle = config.color;
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.8;
                ctx.shadowBlur = 10;
                ctx.shadowColor = config.glowColor;
                
                const bracketSize = 30;
                const padding = 20;
                
                // Top Left
                ctx.beginPath();
                ctx.moveTo(padding + bracketSize, padding);
                ctx.lineTo(padding, padding);
                ctx.lineTo(padding, padding + bracketSize);
                ctx.stroke();
                
                // Top Right
                ctx.beginPath();
                ctx.moveTo(w - padding - bracketSize, padding);
                ctx.lineTo(w - padding, padding);
                ctx.lineTo(w - padding, padding + bracketSize);
                ctx.stroke();
                
                // Bottom Left
                ctx.beginPath();
                ctx.moveTo(padding + bracketSize, h - padding);
                ctx.lineTo(padding, h - padding);
                ctx.lineTo(padding, h - padding - bracketSize);
                ctx.stroke();
                
                // Bottom Right
                ctx.beginPath();
                ctx.moveTo(w - padding - bracketSize, h - padding);
                ctx.lineTo(w - padding, h - padding);
                ctx.lineTo(w - padding, h - padding - bracketSize);
                ctx.stroke();
                
                ctx.globalAlpha = 1.0;
            }
            
            // Reset glow
            ctx.shadowBlur = 0;
        };
    }
},
arcReactor:{
    displayName: "Arc Reactor",
    settings: [
        { id: 'coreColor', type: 'color', label: 'Core Color', default: '#00ffff' },
        { id: 'arcColor', type: 'color', label: 'Arc Color', default: '#ffffff' },
        { id: 'numArcs', type: 'range', label: 'Max Arcs', min: 3, max: 20, step: 1, default: 10 },
        { id: 'arcThickness', type: 'range', label: 'Arc Thickness', min: 1, max: 10, step: 1, default: 4 },
        { id: 'bassSensitivity', type: 'range', label: 'Core Pulse', min: 1, max: 50, step: 1, default: 30 },
        { id: 'midSensitivity', type: 'range', label: 'Arc Count', min: 0.5, max: 2, step: 0.1, default: 1.2 },
    ],
    modules: [],
    draw: (modules, store) => {
        
        // Helper function to draw one arc segment
        function drawArcSegment(ctx, x, y, radius, startAngle, endAngle) {
            ctx.beginPath();
            ctx.arc(x, y, radius, startAngle, endAngle);
            ctx.stroke();
        }
        
        return () => {
            const config = CONFIG.settings.arcReactor;
            const w = canvas2D.width;
            const h = canvas2D.height;
            const cx = w / 2;
            const cy = h / 2;
            
            const dataLen = audioData.length;
            const bass = audioData.slice(0, Math.floor(dataLen * 0.1)).reduce((a, b) => a + b, 0) / (dataLen * 0.1) / 255;
            const mids = audioData.slice(Math.floor(dataLen * 0.1), Math.floor(dataLen * 0.4)).reduce((a, b) => a + b, 0) / (dataLen * 0.3) / 255;
            
            // --- Draw ---
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, w, h);
            
            // --- Draw Core ---
            const coreMinRadius = h * 0.1;
            const corePulse = bass * config.bassSensitivity;
            const coreRadius = coreMinRadius + corePulse;
            
            // Core glow
            ctx.shadowBlur = 40 + corePulse * 2;
            ctx.shadowColor = config.coreColor;
            
            // Core gradient
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
            gradient.addColorStop(0, config.coreColor);
            gradient.addColorStop(0.5, config.coreColor);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // --- Draw Portioned Arcs ---
            const arcsToShow = Math.floor(mids * config.numArcs * config.midSensitivity);
            const startRadius = coreRadius + 30;
            const radiusStep = (h * 0.4 - startRadius) / config.numArcs;
            
            ctx.strokeStyle = config.arcColor;
            ctx.lineWidth = config.arcThickness;
            ctx.shadowBlur = 10;
            ctx.shadowColor = config.arcColor;
            
            // This creates the )))) effect
            const segmentAngle = Math.PI / 8; // The size of each arc segment
            const gapAngle = Math.PI / 16; // The gap between segments
            const numSegments = 4; // Number of segments per ring
            
            for (let i = 0; i < arcsToShow; i++) {
                const radius = startRadius + i * radiusStep;
                
                // Set opacity based on index
                ctx.globalAlpha = mapRange(i, 0, config.numArcs, 1.0, 0.1);
                
                const segmentStart = (Math.PI - (numSegments * (segmentAngle + gapAngle))) / 2;
                
                // Draw segments on the right side
                for(let j = 0; j < numSegments; j++) {
                    const start = -Math.PI/2 + segmentStart + j * (segmentAngle + gapAngle);
                    const end = start + segmentAngle;
                    drawArcSegment(ctx, cx, cy, radius, start, end);
                }
                
                // Draw segments on the left side
                for(let j = 0; j < numSegments; j++) {
                    const start = Math.PI/2 + segmentStart + j * (segmentAngle + gapAngle);
                    const end = start + segmentAngle;
                    drawArcSegment(ctx, cx, cy, radius, start, end);
                }
            }
            
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        };
    }
},
visHUD:{
    displayName: "HUD",
    settings: [
        { id: 'primaryColor', type: 'color', label: 'UI Color', default: '#00ff88' },
        { id: 'glowColor', type: 'color', label: 'Glow Color', default: '#33BBAD' },
        { id: 'showBassGauge', type: 'checkbox', label: 'Show Bass Gauge', default: true },
        { id: 'showMidBar', type: 'checkbox', label: 'Show Mid Bar', default: true },
        { id: 'showHighBar', type: 'checkbox', label: 'Show High Bar', default: true },
        { id: 'showTrebleText', type: 'checkbox', label: 'Show Treble Flash', default: true },
        { id: 'warningThreshold', type: 'range', label: 'Mids Warning Threshold', min: 0.5, max: 1.0, step: 0.05, default: 0.8 },
        { id: 'bassShakeTrigger', type: 'range', label: 'Base Shake Threshold', min: 0.5, max: 1.0, step: 0.05, default: 0.8 },
        { id: 'showReticle', type: 'checkbox', label: 'Show Reticle', default: true },
        { id: 'showCornerText', type: 'checkbox', label: 'Show Corner Text', default: true },
        { id: 'showGraphs', type: 'checkbox', label: 'Show Graphs', default: true },
        { id: 'graphHistory', type: 'range', label: 'Graph History', min: 50, max: 300, step: 10, default: 150 },
    ],
    modules: [
        { id: 'orbitronFont', url: 'https://fonts.gstatic.com/s/orbitron/v31/yMJRMIlzdpvBhQQL_Qq7dy0.woff2', type: 'font' },
    ],
    draw: (modules, store) => {
        if (!store.bassNeedle) store.bassNeedle = 0;
        if (!store.midBar) store.midBar = 0;
        if (!store.highBar) store.highBar = 0;
        if (!store.trebleFlash) store.trebleFlash = 0;
        if (!store.shake) store.shake = 0;
        if (!store.frame) store.frame = 0;
        // Init history arrays for graphs
        if (!store.bassHistory) store.bassHistory = [];
        if (!store.midHistory) store.midHistory = [];
        if (!store.highHistory) store.highHistory = [];
        
        return () => {
            const config = CONFIG.settings.visHUD;
            const w = canvas2D.width;
            const h = canvas2D.height;
            const cx = w / 2;
            const cy = h / 2;
            
            const fontName = modules.orbitronFont || 'sans-serif';
            
            // Audio analysis
            const dataLen = audioData.length;
            const bass = audioData.slice(0, Math.floor(dataLen * 0.1)).reduce((a, b) => a + b, 0) / (dataLen * 0.1) / 255;
            const mids = audioData.slice(Math.floor(dataLen * 0.1), Math.floor(dataLen * 0.4)).reduce((a, b) => a + b, 0) / (dataLen * 0.3) / 255;
            const highs = audioData.slice(Math.floor(dataLen * 0.4), dataLen).reduce((a, b) => a + b, 0) / (dataLen * 0.6) / 255;
            const overall = (bass + mids + highs) / 3;
            store.frame++;
            
            // --- Update Graph History ---
            const maxHistory = config.graphHistory;
            store.bassHistory.push(bass);
            store.midHistory.push(mids);
            store.highHistory.push(highs);
            
            if (store.bassHistory.length > maxHistory) store.bassHistory.shift();
            if (store.midHistory.length > maxHistory) store.midHistory.shift();
            if (store.highHistory.length > maxHistory) store.highHistory.shift();
            
            
            // --- Shake Effect ---
            if (bass > config.bassShakeTrigger) store.shake = 15; // Set shake intensity
            
            ctx.save();
            if (store.shake > 0) {
                const xOffset = (Math.random() - 0.5) * store.shake;
                const yOffset = (Math.random() - 0.5) * store.shake;
                ctx.translate(xOffset, yOffset);
                store.shake *= 0.8; // Decay
            }
            
            // --- Draw ---
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Fading background
            ctx.fillRect(0, 0, w, h);
            
            ctx.strokeStyle = config.primaryColor;
            ctx.fillStyle = config.primaryColor;
            ctx.shadowColor = config.glowColor;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2;
            ctx.font = `18px ${fontName}`;
            
            // --- 1. Bass Gauge (Bottom Left) ---
            if (config.showBassGauge) {
                const gaugeX = w * 0.15;
                const gaugeY = h * 0.85;
                const radius = h * 0.3;
                
                // Draw gauge housing (arc)
                ctx.beginPath();
                ctx.arc(gaugeX, gaugeY, radius, Math.PI, 0);
                ctx.stroke();
                
                // Draw tick marks
                ctx.lineWidth = 1;
                for (let i = 0; i <= 10; i++) {
                    const angle = Math.PI + (i / 10) * Math.PI;
                    const sx = gaugeX + Math.cos(angle) * (radius - 5);
                    const sy = gaugeY + Math.sin(angle) * (radius - 5);
                    const ex = gaugeX + Math.cos(angle) * radius;
                    const ey = gaugeY + Math.sin(angle) * radius;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                }
                ctx.lineWidth = 2;
                
                // Draw label
                ctx.textAlign = 'center';
                ctx.fillText("BASS", gaugeX, gaugeY - 10);
                
                // Draw needle
                const targetAngle = Math.PI + bass * Math.PI;
                store.bassNeedle = store.bassNeedle * 0.9 + targetAngle * 0.1; // Smooth
                
                ctx.beginPath();
                ctx.moveTo(gaugeX, gaugeY);
                ctx.lineTo(gaugeX + Math.cos(store.bassNeedle) * (radius - 10), gaugeY + Math.sin(store.bassNeedle) * (radius - 10));
                ctx.strokeStyle = config.primaryColor;
                ctx.stroke();
            }
            
            // --- 2. Mid Bar (Bottom Right) ---
            if (config.showMidBar) {
                const barX = w * 0.7;
                const barY = h * 0.85;
                const barW = w * 0.2;
                const barH = h * 0.1;
                
                // Draw bar outline
                ctx.strokeRect(barX, barY - barH, barW, barH);
                
                // Draw label
                ctx.textAlign = 'center';
                ctx.fillText("MIDS", barX + barW / 2, barY - barH - 10);
                
                // Draw filling
                const targetHeight = mids * barH;
                store.midBar = store.midBar * 0.85 + targetHeight * 0.15; // Smooth
                ctx.fillRect(barX, barY - store.midBar, barW, store.midBar);
            }
            
            // --- 3. High Bar (Top Right) ---
            if (config.showHighBar) {
                const barX = w * 0.9;
                const barY = h * 0.1;
                const barW = w * 0.05;
                const barH = h * 0.3;
                
                // Draw bar outline
                ctx.strokeRect(barX, barY, barW, barH);
                
                // Draw label
                ctx.textAlign = 'center';
                ctx.fillText("HIGHS", barX + barW / 2, barY - 10);
                
                // Draw filling
                const targetHeight = highs * barH;
                store.highBar = store.highBar * 0.8 + targetHeight * 0.2; // Smooth
                ctx.fillRect(barX, barY, barW, store.highBar);
            }
            
            // --- 4. Treble Flash Text (Top Center) ---
            if (config.showTrebleText) {
                ctx.textAlign = 'center';
                ctx.font = `24px ${fontName}`;
                
                if (mids > config.warningThreshold) {
                    store.trebleFlash = 1.0; // Set flash to full opacity
                }
                
                if (store.trebleFlash > 0) {
                    ctx.globalAlpha = store.trebleFlash;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = config.glowColor;
                    
                    ctx.fillText("! WARNING !", cx, h * 0.1);
                    
                    store.trebleFlash *= 0.9; // Fade out
                }
                ctx.globalAlpha = 1.0;
            }
            
            // --- 5. Central Reticle ---
            if (config.showReticle) {
                const r = h * 0.05 + overall * 20;
                ctx.lineWidth = 1;
                
                // Outer circle
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                
                // Crosshairs
                ctx.beginPath();
                ctx.moveTo(cx - r, cy);
                ctx.lineTo(cx - r * 0.6, cy);
                ctx.moveTo(cx + r, cy);
                ctx.lineTo(cx + r * 0.6, cy);
                ctx.moveTo(cx, cy - r);
                ctx.lineTo(cx, cy - r * 0.6);
                ctx.moveTo(cx, cy + r);
                ctx.lineTo(cx, cy + r * 0.6);
                ctx.stroke();
                
                // Inner dot
                ctx.beginPath();
                ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // --- 6. Corner Text ---
            let topLeftY = 40; // Default Y position
            if (config.showCornerText) {
                ctx.font = `14px ${fontName}`;
                ctx.textAlign = 'left';
                ctx.globalAlpha = 0.7;
                
                // Adjust Y if graphs are shown
                if (config.showGraphs) {
                    topLeftY = h * 0.5 + 30; // Position below the new graphs
                }
                
                // Top Left
                ctx.fillText("SYSTEM: ONLINE", 30, topLeftY);
                ctx.fillText(`FRAME: ${store.frame}`, 30, topLeftY + 20);
                
                // Top Right
                ctx.textAlign = 'right';
                ctx.fillText("TARGET: ACQUIRED", w - 30, 40);
                ctx.fillText(`FREQ: ${Math.round(overall * 100)}%`, w - 30, 60);
                
                ctx.globalAlpha = 1.0;
            }
            
            // --- 7. Draw Line Graphs ---
            if (config.showGraphs) {
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.8;
                ctx.font = `14px ${fontName}`;
                
                const gW = w * 0.2, gH = h * 0.08, gPad = 10;
                const gX = 30;
                const gY_Bass = h * 0.15;
                const gY_Mid = gY_Bass + gH + gPad + 20;
                const gY_High = gY_Mid + gH + gPad + 20;
                
                // Draw Bass Graph
                ctx.textAlign = 'center'; 
                ctx.fillText("BASS RMS", gX + gW / 2, gY_Bass - 10);
                ctx.strokeRect(gX, gY_Bass, gW, gH);
                ctx.beginPath();
                ctx.moveTo(gX, gY_Bass + gH);
                for (let i = 0; i < store.bassHistory.length; i++) {
                    const xPos = gX + (i / maxHistory) * gW;
                    const yPos = gY_Bass + gH - (store.bassHistory[i] * gH);
                    ctx.lineTo(xPos, yPos);
                }
                ctx.stroke();
                
                // Draw Mid Graph
                ctx.textAlign = 'center'; 
                ctx.fillText("MID RMS", gX + gW / 2, gY_Mid - 10);
                ctx.strokeRect(gX, gY_Mid, gW, gH);
                ctx.beginPath();
                ctx.moveTo(gX, gY_Mid + gH);
                for (let i = 0; i < store.midHistory.length; i++) {
                    const xPos = gX + (i / maxHistory) * gW;
                    const yPos = gY_Mid + gH - (store.midHistory[i] * gH);
                    ctx.lineTo(xPos, yPos);
                }
                ctx.stroke();
                
                // Draw High Graph
                ctx.textAlign = 'center'; 
                ctx.fillText("HIGH RMS", gX + gW / 2, gY_High - 10);
                ctx.strokeRect(gX, gY_High, gW, gH);
                ctx.beginPath();
                ctx.moveTo(gX, gY_High + gH);
                for (let i = 0; i < store.highHistory.length; i++) {
                    const xPos = gX + (i / maxHistory) * gW;
                    const yPos = gY_High + gH - (store.highHistory[i] * gH);
                    ctx.lineTo(xPos, yPos);
                }
                ctx.stroke();
                
                ctx.globalAlpha = 1.0;
            }
            
            // Reset shadow and restore context from shake
            ctx.lineWidth = 2; // Reset default line width
            ctx.shadowBlur = 0;
            ctx.restore();
        };
    }
},
dataPulse:{
    displayName: "CPU Pulse",
    settings: [
        { id: 'pulseColor', type: 'color', label: 'Pulse Color', default: '#00ffff' },
        { id: 'traceColor', type: 'color', label: 'Trace Color', default: '#004444' },
        { id: 'chipColor', type: 'color', label: 'Chip Color', default: '#1a1a1a' },
        { id: 'chipBorderColor', type: 'color', label: 'Chip Border', default: '#999999' },
        { id: 'chipText', type: 'text', label: 'Chip Text', default: 'CPU' },
        { id: 'numTraces', type: 'range', label: 'Num Traces', min: 4, max: 40, step: 2, default: 20 },
        { id: 'traceWidth', type: 'range', label: 'Trace Width', min: 1, max: 8, step: 1, default: 2 },
        { id: 'viaSize', type: 'range', label: 'Via (Pin Hole) Size', min: 0, max: 6, step: 1, default: 3 },
        { id: 'traceAngle', type: 'select', label: 'Trace Angles', options: ['90', '45', 'Both'], default: '90' },
        { id: 'squiggleChance', type: 'range', label: 'Squiggle Chance', min: 0, max: 1, step: 0.1, default: 0.2 },
        { id: 'bassDeltaThreshold', type: 'range', label: 'Pulse Trigger (Delta)', min: 0.01, max: 0.5, step: 0.01, default: 0.1 },
        { id: 'pulseSpeed', type: 'range', label: 'Base Pulse Speed', min: 0.01, max: 0.1, step: 0.005, default: 0.03 },
    ],
    modules: [
        // Add orbitron for the "CPU" text
        { id: 'orbitronFont', url: 'https://fonts.gstatic.com/s/orbitron/v31/yMJRMIlzdpvBhQQL_Qq7dy0.woff2', type: 'font' },
    ],
    draw: (modules, store) => {
        if (!store.initialized) store.initialized = false;
        if (!store.traces) store.traces = [];
        if (!store.pulses) store.pulses = [];
        if (!store.prevBass) store.prevBass = 0;
        if (!store.prevConfig) store.prevConfig = {};
        
        // --- Helper: Get random point on a rect's edge ---
        function getPointOnRect(r) {
            const side = Math.floor(Math.random() * 4);
            switch (side) {
                case 0: return { x: r.x + Math.random() * r.w, y: r.y }; // Top
                case 1: return { x: r.x + Math.random() * r.w, y: r.y + r.h }; // Bottom
                case 2: return { x: r.x, y: r.y + Math.random() * r.h }; // Left
                case 3: return { x: r.x + r.w, y: r.y + Math.random() * r.h }; // Right
            }
            return { x: r.x, y: r.y }; // fallback
        }
        
        // --- Helper: Get initial direction vector away from chip ---
        function getInitialDir(p, r) {
            if (p.y === r.y) return { x: 0, y: -1 }; // Top
            if (p.y === r.y + r.h) return { x: 0, y: 1 }; // Bottom
            if (p.x === r.x) return { x: -1, y: 0 }; // Left
            if (p.x === r.x + r.w) return { x: 1, y: 0 }; // Right
            return {x: 0, y: -1}; // Default
        }
        
        // --- Helper: Turn 90 degrees ---
        function turn90(dir, turnRight) {
            if (turnRight) {
                return { x: -dir.y, y: dir.x };
            } else {
                return { x: dir.y, y: -dir.x };
            }
        }
        
        // --- Helper: Turn 45 degrees ---
        function turn45(dir, turnRight) {
            const { x, y } = dir;
            let newDir;
            if (turnRight) { newDir = { x: x - y, y: x + y }; }
            else { newDir = { x: x + y, y: y - x }; }
            const mag = Math.sqrt(newDir.x * newDir.x + newDir.y * newDir.y);
            if (mag === 0) return dir; // Should not happen
            return { x: newDir.x / mag, y: newDir.y / mag };
        }
        
        // --- Helper: Draw a squiggle segment ---
        function drawSquiggleSegment(ctx, start, end) {
            const dx = end.x - start.x, dy = end.y - start.y;
            const mag = Math.sqrt(dx * dx + dy * dy);
            if (mag === 0) return;
            const perpX = -dy / mag, perpY = dx / mag;
            const numWiggles = 6;
            const amplitude = 8;
            
            for (let t = 0.05; t <= 1.01; t += 0.05) {
                const x = start.x + dx * t;
                const y = start.y + dy * t;
                const offset = Math.sin(t * Math.PI * numWiggles) * amplitude;
                ctx.lineTo(x + perpX * offset, y + perpY * offset);
            }
        }
        
        // --- Helper function to generate the traces ---
        function generateTraces(store, w, h, config) {
            store.traces = [];
            const cx = w / 2;
            const cy = h / 2;
            const chipW = 100, chipH = 60;
            const chipRect = { x: cx - chipW/2, y: cy - chipH/2, w: chipW, h: chipH };
            store.chipRect = chipRect;
            
            for (let i = 0; i < config.numTraces; i++) {
                const trace = [];
                let startPos = getPointOnRect(chipRect);
                trace.push({ pos: startPos, squiggle: false }); // Start point
                
                let currentPos = startPos;
                let currentDir = getInitialDir(startPos, chipRect);
                
                // 1. Move away from chip
                let moveDist = 20 + Math.random() * 30;
                currentPos = { x: currentPos.x + currentDir.x * moveDist, y: currentPos.y + currentDir.y * moveDist };
                trace.push({ pos: currentPos, squiggle: false }); // First segment
                
                // 2. Path randomly
                const numSegments = 5 + Math.floor(Math.random() * 5);
                for (let j = 0; j < numSegments; j++) {
                    // Decide turn type
                    let turnType = config.traceAngle;
                    if (turnType === 'Both') turnType = Math.random() > 0.5 ? '90' : '45';
                    
                    if (turnType === '90') {
                        currentDir = turn90(currentDir, Math.random() > 0.5);
                    } else {
                        currentDir = turn45(currentDir, Math.random() > 0.5);
                    }
                    
                    moveDist = 40 + Math.random() * 150;
                    currentPos = { x: currentPos.x + currentDir.x * moveDist, y: currentPos.y + currentDir.y * moveDist };
                    
                    // Stop if we go way off screen
                    if (currentPos.x < -w || currentPos.x > w*2 || currentPos.y < -h || currentPos.y > h*2) {
                        break;
                    }
                    
                    const isSquiggle = Math.random() < config.squiggleChance;
                    trace.push({ pos: currentPos, squiggle: isSquiggle });
                }
                store.traces.push(trace);
            }
            store.initialized = true;
        }
        
        // --- Return the main draw function ---
        return () => {
            const config = CONFIG.settings.dataPulse;
            const w = canvas2D.width;
            const h = canvas2D.height;
            const fontName = modules.orbitronFont || 'sans-serif';
            
            // --- Audio Analysis (with Delta) ---
            const dataLen = audioData.length;
            const bass = audioData.slice(0, Math.floor(dataLen * 0.1)).reduce((a, b) => a + b, 0) / (dataLen * 0.1) / 255;
            const highs = audioData.slice(Math.floor(dataLen * 0.7), dataLen).reduce((a, b) => a + b, 0) / (dataLen * 0.3) / 255;
            const bassDelta = bass - store.prevBass;
            store.prevBass = bass;
            
            // --- Re-generate if config changes ---
            if (store.w !== w || store.h !== h || 
                store.prevConfig.numTraces !== config.numTraces ||
                store.prevConfig.traceAngle !== config.traceAngle ||
                store.prevConfig.squiggleChance !== config.squiggleChance
            ) {
                store.initialized = false;
            }
            
            if (!store.initialized) {
                generateTraces(store, w, h, config);
                store.w = w; store.h = h;
                store.prevConfig.numTraces = config.numTraces;
                store.prevConfig.traceAngle = config.traceAngle;
                store.prevConfig.squiggleChance = config.squiggleChance;
            }
            
            // --- Draw ---
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, w, h);
            
            // --- 1. Draw Static Traces ---
            ctx.strokeStyle = config.traceColor;
            ctx.lineWidth = config.traceWidth;
            ctx.shadowBlur = 5;
            ctx.shadowColor = config.traceColor;
            ctx.globalAlpha = 0.5;
            
            for (const trace of store.traces) {
                ctx.beginPath();
                ctx.moveTo(trace[0].pos.x, trace[0].pos.y);
                for (let i = 0; i < trace.length - 1; i++) {
                    const start = trace[i].pos;
                    const end = trace[i + 1].pos;
                    const isSquiggle = trace[i + 1].squiggle;
                    
                    if (isSquiggle) {
                        drawSquiggleSegment(ctx, start, end);
                    } else {
                        ctx.lineTo(end.x, end.y);
                    }
                }
                ctx.stroke();
            }
            
            // --- 2. Draw Vias (Pin Holes) ---
            ctx.fillStyle = config.traceColor;
            ctx.shadowBlur = 2;
            ctx.shadowColor = config.traceColor;
            if (config.viaSize > 0) {
                for (const trace of store.traces) {
                    for (let i = 1; i < trace.length; i++) { // Start from 1 (first turn)
                        const p = trace[i].pos;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, config.viaSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1.0;
            
            // --- 3. Draw Central Chip ---
            const r = store.chipRect;
            ctx.shadowBlur = 10;
            ctx.shadowColor = config.chipBorderColor;
            ctx.fillStyle = config.chipColor;
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = config.chipBorderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            
            ctx.fillStyle = config.pulseColor;
            ctx.font = `20px ${fontName}`;
            ctx.textAlign = 'center';
            ctx.shadowColor = config.pulseColor;
            ctx.shadowBlur = 10;
            ctx.fillText(config.chipText, r.x + r.w / 2, r.y + r.h / 2 + 8);
            
            // --- 4. Create New Pulses on Bass Delta ---
            if (bassDelta > config.bassDeltaThreshold) {
                for (let i = 0; i < store.traces.length; i++) {
                    if (Math.random() > 0.5) { // 50% chance per trace
                        store.pulses.push({
                            traceIndex: i,
                            segment: 0,
                            pos: 0,
                            speed: config.pulseSpeed + highs * 0.05, // Speed boosted by highs
                            life: 1.0
                        });
                    }
                }
            }
            
            // --- 5. Update and Draw Pulses ---
            ctx.fillStyle = config.pulseColor;
            ctx.shadowBlur = 15;
            ctx.shadowColor = config.pulseColor;
            
            for (let i = store.pulses.length - 1; i >= 0; i--) {
                const p = store.pulses[i];
                const trace = store.traces[p.traceIndex];
                
                if (!trace || p.segment >= trace.length - 1 || p.life <= 0) {
                    store.pulses.splice(i, 1);
                    continue;
                }
                
                p.pos += p.speed;
                p.life -= 0.01; // Fade out
                
                const startNode = trace[p.segment].pos;
                const endNode = trace[p.segment + 1].pos;
                const isSquiggle = trace[p.segment + 1].squiggle;
                
                const dx = endNode.x - startNode.x, dy = endNode.y - startNode.y;
                let x = startNode.x + dx * p.pos;
                let y = startNode.y + dy * p.pos;
                
                if (isSquiggle) {
                    const mag = Math.sqrt(dx * dx + dy * dy);
                    if (mag > 0) {
                        const perpX = -dy / mag, perpY = dx / mag;
                        const offset = Math.sin(p.pos * Math.PI * 6) * 8;
                        x += perpX * offset;
                        y += perpY * offset;
                    }
                }
                
                if (p.pos >= 1.0) {
                    p.pos = 0;
                    p.segment++;
                }
                
                ctx.globalAlpha = p.life;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        };
    }
},
/*blank: {
  displayName: "blank",
  settings: [
      //duh
  ],

  modules: [
      //duh
  ],
  

  draw: (modules, store) => {
  
  //init here
  return () => {
      //per draw call here
  };
}

},*/


 testVisualizer: {
    displayName: "Test Visualizer",
    settings: [
      { id: 'text', type: 'text', label: 'Text', default: 'TEST' },
      { id: 'color', type: 'color', label: 'Color', default: '#00ff00' },
      { id: 'size', type: 'range', label: 'Size', min: 20, max: 200, step: 10, default: 60 },
      { id: 'file', type: 'file', label: 'filetest'}
    ],
    modules: [
      { id: 'orbitron', url: 'example.woff2', type: 'font' },
      { id: 'orbitron', url: 'example.png', type: 'image' }
    ],
    draw: (modules, store) => {
      if (!store.angle) store.angle = 0;

      return () => {
        const thisConfig = CONFIG.settings.testVisualizer;

        // Simple audio split
        const bass = audioData.slice(0, 32).reduce((a,b)=>a+b,0) / 32;

        // Update angle based on bass
        store.angle += (bass/255) * 0.001;

        ctx.save();
        ctx.translate(canvas2D.width/2, canvas2D.height/2);
        ctx.rotate(store.angle);

        // Use loaded font if available
        const fontName = modules.orbitron || 'Impact';
        ctx.font = `${thisConfig.size}px ${fontName}`;
        ctx.fillStyle = thisConfig.color;
        ctx.textAlign = 'center';
        ctx.fillText(thisConfig.text, 0, 0);

        ctx.restore();
      };
    }
  }
};
