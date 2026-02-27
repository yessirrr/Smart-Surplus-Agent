interface HeaderProps {
  userName: string;
}

export function Header({ userName }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-6">
      <div>
        <p className="text-sm text-ws-grey">Good morning,</p>
        <h1 className="text-xl font-bold text-ws-charcoal">{userName}</h1>
      </div>
      <div className="w-9 h-9 rounded-full bg-ws-light-grey flex items-center justify-center">
        <span className="text-sm font-bold text-ws-charcoal">
          {userName.charAt(0)}
        </span>
      </div>
    </header>
  );
}
