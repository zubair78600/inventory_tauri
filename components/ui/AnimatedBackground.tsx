'use client';

import { useEffect, useRef } from 'react';

export function AnimatedBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particles: Particle[] = [];
        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Mouse state
        const mouse = { x: -1000, y: -1000 };

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initParticles();
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            color: string;
            originalVx: number;
            originalVy: number;

            constructor() {
                // Start from center (Explosion effect)
                // Spread starting point slightly more to avoid a perfect "ring" look
                this.x = width / 2 + (Math.random() - 0.5) * 100;
                this.y = height / 2 + (Math.random() - 0.5) * 100;

                // Initial "Explosion" velocity - MUCH faster to cover screen in <1s
                const explosionPower = 40;
                this.vx = (Math.random() - 0.5) * explosionPower;
                this.vy = (Math.random() - 0.5) * explosionPower;

                // Target "Ambience" velocity
                this.originalVx = (Math.random() - 0.5) * 0.5;
                this.originalVy = (Math.random() - 0.5) * 0.5;

                // Randomize size: mostly small dots, some slightly larger
                this.size = Math.random() < 0.9 ? Math.random() * 1.5 + 0.5 : Math.random() * 2 + 1.5;

                // Colors from specific blue palette + some greys for depth
                const colors = [
                    '#3b82f6', // blue-500
                    '#60a5fa', // blue-400
                    '#93c5fd', // blue-300
                    '#cbd5e1', // slate-300
                    '#94a3b8', // slate-400
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                // Basic movement
                this.x += this.vx;
                this.y += this.vy;

                // Mouse Interaction
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const interactionRadius = 200; // Interaction zone size

                if (distance < interactionRadius) {
                    // Calculate repulsion force (stronger when closer)
                    const force = (interactionRadius - distance) / interactionRadius;
                    const angle = Math.atan2(dy, dx);

                    // Push away
                    const pushX = Math.cos(angle) * force * 1.5;
                    const pushY = Math.sin(angle) * force * 1.5;

                    this.vx -= pushX * 0.05;
                    this.vy -= pushY * 0.05;
                } else {
                    // Return to original velocity slowly (Friction/Drag)
                    // Reduced drag (0.98 instead of 0.96) so they fly further/faster initially
                    this.vx = this.vx * 0.98 + this.originalVx * 0.02;
                    this.vy = this.vy * 0.98 + this.originalVy * 0.02;
                }

                // Limit max speed ONLY after initial explosion phase
                // We detect this by checking if we are significantly faster than normal
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const maxAmbienceSpeed = 2.0;

                // Allow them to fly fast initially (explosion), only clamp if they are "kinda" fast 
                // but not super fast, OR just rely on friction to bring them down.
                // We'll let friction do the work for the explosion decay.
                // We only clamp if the speed is low enough to likely be a mouse interaction 
                // that pushed it slightly over.
                // Or simply: DON'T clamp if speed > 10 (explosion happening).
                if (speed > maxAmbienceSpeed && speed < 10) {
                    this.vx = (this.vx / speed) * maxAmbienceSpeed;
                    this.vy = (this.vy / speed) * maxAmbienceSpeed;
                }

                // Screen wrap
                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                // Draw slightly elongated shape if moving fast for effect? Nah, dots are cleaner.
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }

        const initParticles = () => {
            particles = [];
            // Adjust density based on screen size
            // Lower number = MORE particles. 
            // Previous: 5000. 
            // User wants even more. Let's go to 2500 (Double the previous request).
            const density = 2500;
            const particleCount = Math.floor((width * height) / density);

            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                p.update();
                p.draw();
            });

            requestAnimationFrame(animate);
        };

        // Setup
        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        // Initial setup
        handleResize();
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-60 z-0"
        />
    );
}
