/** Uses the same seat order, initial and colour as the round-table avatars. */
export function PlayerIdentity({ name, index, suffix = "" }: {
  name: string; index: number; suffix?: string;
}) {
  return <span className="player-identity">
    <span className={`avatar color-${Math.max(0, index) % 4}`} aria-hidden="true">{name.slice(0, 1)}</span>
    <span>{name}{suffix}</span>
  </span>;
}
