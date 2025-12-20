import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Bot, Mail, Phone, MapPin, Sparkles, ShieldCheck } from "lucide-react";

interface IdentityData {
    type: 'identity';
    company_name: string;
    address?: string;
    phone?: string;
    email?: string;
    message: string;
}

export function IdentityCard({ data }: { data: IdentityData }) {
    const cardRef = useRef<HTMLDivElement>(null);

    // 3D Tilt Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 50, damping: 10 });
    const mouseY = useSpring(y, { stiffness: 50, damping: 10 });

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXRel = e.clientX - rect.left;
        const mouseYRel = e.clientY - rect.top;

        const xPct = (mouseXRel / width) - 0.5;
        const yPct = (mouseYRel / height) - 0.5;

        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <div style={{ perspective: "1200px" }} className="w-full max-w-[650px] mx-auto py-10">
            <motion.div
                ref={cardRef}
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative rounded-[2rem] bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl group"
            >
                {/* Glossy Overlay (Glass Reflection) */}
                <div
                    className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50 pointer-events-none"
                    style={{ transform: "translateZ(1px)" }}
                />

                {/* Moving Sheen Effect */}
                <motion.div
                    className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                    style={{
                        transform: "translateZ(2px)",
                        opacity: useTransform(mouseX, [-0.5, 0.5], [0, 0.5])
                    }}
                />

                <div className="relative p-10 flex flex-col md:flex-row gap-10 items-center md:items-stretch" style={{ transform: "translateZ(20px)" }}>

                    {/* Left Side: Brand & Logo */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="relative group/logo">
                            <div className="absolute inset-0 bg-cyan-500 blur-[50px] opacity-20 group-hover/logo:opacity-40 transition-opacity duration-500" />
                            <div className="relative h-32 w-32 rounded-full border-2 border-white/10 bg-black/20 flex items-center justify-center overflow-hidden backdrop-blur-sm shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                                <Bot className="h-16 w-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />

                                {/* Circuit decorations */}
                                <div className="absolute inset-0 border-[3px] border-cyan-500/30 rounded-full border-t-transparent animate-[spin_10s_linear_infinite]" />
                                <div className="absolute inset-2 border-[1px] border-indigo-500/30 rounded-full border-b-transparent animate-[spin_15s_linear_infinite_reverse]" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 drop-shadow-sm">
                                {data.company_name}
                            </h2>
                            <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-500 uppercase">
                                Enterprise Intelligence
                            </p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block" />

                    {/* Right Side: Details */}
                    <div className="flex-[1.5] flex flex-col justify-center space-y-6 w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3" /> Verified System
                            </span>
                        </div>

                        <div className="space-y-4">
                            {data.address && (
                                <div className="group/item flex items-start gap-4">
                                    <div className="mt-1 h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:bg-cyan-500/20 group-hover/item:border-cyan-500/30 transition-colors">
                                        <MapPin className="h-4 w-4 text-slate-400 group-hover/item:text-cyan-300 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Headquarters</p>
                                        <p className="text-sm font-medium text-slate-200 mt-0.5">{data.address}</p>
                                    </div>
                                </div>
                            )}

                            {data.phone && (
                                <div className="group/item flex items-start gap-4">
                                    <div className="mt-1 h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:bg-indigo-500/20 group-hover/item:border-indigo-500/30 transition-colors">
                                        <Phone className="h-4 w-4 text-slate-400 group-hover/item:text-indigo-300 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Contact Line</p>
                                        <p className="text-sm font-medium text-slate-200 mt-0.5">{data.phone}</p>
                                    </div>
                                </div>
                            )}

                            {data.email && (
                                <div className="group/item flex items-start gap-4">
                                    <div className="mt-1 h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:bg-purple-500/20 group-hover/item:border-purple-500/30 transition-colors">
                                        <Mail className="h-4 w-4 text-slate-400 group-hover/item:text-purple-300 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Email Inquiry</p>
                                        <p className="text-sm font-medium text-slate-200 mt-0.5">{data.email}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Interactive "Start Chat" Button style representation */}
                        <div className="pt-4 flex gap-3">
                            <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-xs font-bold text-white shadow-lg shadow-cyan-900/20 border border-white/10 hover:brightness-110 active:scale-95 transition-all">
                                VIEW PROFILE
                            </button>
                            <button className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all">
                                SYSTEM LOGS
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
