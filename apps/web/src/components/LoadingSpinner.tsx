export default function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="w-10 h-10 border-4 border-border border-t-secondary rounded-full animate-spin" />
      {text && <p className="text-muted text-sm">{text}</p>}
    </div>
  );
}
