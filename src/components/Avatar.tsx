import type { CSSProperties } from 'react';
import type { Member } from '../types';
import { initials } from '../lib/config';

export function Avatar({ member, size = 32, ring = true }: { member: Member; size?: number; ring?: boolean }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: member.avatar.type === 'emoji' ? size * 0.6 : size * 0.4,
    background: member.avatar.type === 'image' ? undefined : member.color,
    boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 4px ${member.color}` : undefined,
  };
  return (
    <span className="avatar" style={style} title={member.name} aria-label={member.name}>
      {member.avatar.type === 'image' ? (
        <img src={member.avatar.dataUrl} alt="" />
      ) : member.avatar.type === 'emoji' ? (
        <span className="avatar-emoji">{member.avatar.value}</span>
      ) : (
        <span className="avatar-initials">{initials(member.name)}</span>
      )}
    </span>
  );
}

export function AvatarStack({ members, size = 22 }: { members: Member[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} ring={false} />
      ))}
    </span>
  );
}
