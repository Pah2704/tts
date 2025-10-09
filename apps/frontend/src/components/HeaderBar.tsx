type Props = {
  docsHref?: string;
};

export function HeaderBar({ docsHref = 'https://docs.example.com' }: Props) {
  return (
    <header className="top-header">
      <div className="top-header__brand">TTS Workspace</div>
      <a className="top-header__link" href={docsHref} target="_blank" rel="noreferrer">
        Docs
      </a>
    </header>
  );
}
