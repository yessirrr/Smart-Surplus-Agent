import { Bot } from "lucide-react";

export function AgentCard() {
  return (
    <div className="rounded-[8px] border-2 border-dashed border-ws-border p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[120px]">
      <Bot size={24} className="text-ws-grey" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-bold text-ws-grey">Smart Surplus Agent</p>
        <p className="text-xs text-ws-grey mt-1">
          AI-powered investment recommendations will appear here
        </p>
      </div>
    </div>
  );
}
