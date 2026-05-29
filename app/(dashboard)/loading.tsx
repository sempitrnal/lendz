import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-black lowercase text-slate-900">loading...</p>
      </div>
    </div>
  );
}
