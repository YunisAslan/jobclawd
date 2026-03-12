import { CVPerformanceEntry } from "@/components/dashboard/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

export default function CVPerformanceTable({ data }: { data: CVPerformanceEntry[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No applications yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>CV</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead className="text-right">Replies</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium max-w-[140px] truncate">{row.cv_name}</TableCell>
            <TableCell className="text-right">{row.sent}</TableCell>
            <TableCell
              className={`text-right font-semibold ${row.replies > 0 ? "text-success" : "text-foreground"}`}
            >
              {row.replies}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
