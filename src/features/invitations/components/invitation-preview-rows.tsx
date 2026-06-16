import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvitationGenerationItemSummary } from "@/lib/invitations/generation";

export function InvitationPreviewRows({
  items,
}: {
  readonly items: readonly InvitationGenerationItemSummary[];
}) {
  const visibleItems = items.slice(0, 8);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Expert ID</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Link</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleItems.map((item) => (
          <TableRow key={item.invitationId}>
            <TableCell className="font-mono text-xs">{item.sequence}</TableCell>
            <TableCell className="font-mono text-xs">{item.expertId}</TableCell>
            <TableCell className="max-w-52 truncate font-mono text-xs">
              {item.plaintextToken}
            </TableCell>
            <TableCell className="max-w-72 truncate font-mono text-xs">
              {item.inviteLink}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
