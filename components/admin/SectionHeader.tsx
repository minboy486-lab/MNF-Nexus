type Props = {
  title: string;
  children?: React.ReactNode;
};

export function SectionHeader({ title, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5">
      <h2 className="section-title flex items-center gap-3">
        <span className="section-title-accent" />
        {title}
      </h2>
      {children}
    </div>
  );
}
