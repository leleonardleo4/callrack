import React from 'react';
import { Server, Database, Layers, Cpu, CheckCircle2 } from 'lucide-react';

export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 font-sans">
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xl shadow-inner">
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Callrack</h1>
            <p className="text-xs text-slate-400">Pay-per-use Information Infrastructure</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Phase 0: Repository Foundation</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full my-auto py-12">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-3 py-1 rounded-md">
            Monorepo Active
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4 text-white leading-tight">
            Development Foundation Ready
          </h2>
          <p className="text-slate-400 text-base md:text-lg mt-4 leading-relaxed">
            The workspace environment is fully initialized with Turborepo, pnpm workspaces, NestJS Fastify API, React Vite frontend, Prisma 7, and shared workspace packages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-200">
            <div className="flex items-center justify-between text-indigo-400 mb-3">
              <Server className="h-6 w-6" />
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">API Engine</h3>
            <p className="text-xs text-slate-400 mt-1">NestJS + Fastify + TS</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-200">
            <div className="flex items-center justify-between text-indigo-400 mb-3">
              <Cpu className="h-6 w-6" />
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Web Frontend</h3>
            <p className="text-xs text-slate-400 mt-1">React + Vite + Tailwind</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-200">
            <div className="flex items-center justify-between text-indigo-400 mb-3">
              <Database className="h-6 w-6" />
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Infrastructure</h3>
            <p className="text-xs text-slate-400 mt-1">PostgreSQL + Redis + Prisma 7</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-200">
            <div className="flex items-center justify-between text-indigo-400 mb-3">
              <Layers className="h-6 w-6" />
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Shared Packages</h3>
            <p className="text-xs text-slate-400 mt-1">config, types, validation, sdk</p>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto w-full py-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Callrack Infrastructure &copy; 2026</span>
        <span>pnpm + Turborepo Workspace</span>
      </footer>
    </div>
  );
}

export default App;
