interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && <div className="text-muted-foreground/40">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
