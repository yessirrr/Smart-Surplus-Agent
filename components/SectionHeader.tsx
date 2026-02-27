interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <h2 className="text-sm font-bold text-ws-grey uppercase tracking-wide">
        {title}
      </h2>
      {action}
    </div>
  );
}
