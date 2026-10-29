import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, shiftMonth } from "@/lib/analytics";
import { attendanceDisplayStatus, dateToString, formatTime, hoursBetween, statusLabel } from "@/lib/format";

type Record = { date: Date; status: string; timeIn: Date | null; timeOut: Date | null };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthName = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

// Month view of attendance; each day shows its status with a text label, not color alone.
export function AttendanceCalendar({ year, month, records, today, href }: { year: number; month: number; records: Record[]; today: Date; href: (month: string) => string }) {
  const todayString = dateToString(today);
  const byDate = new Map(records.map((record) => [dateToString(record.date), record]));
  const weeks = monthGrid(year, month, todayString);
  const current = `${year}-${String(month).padStart(2, "0")}`;
  const isCurrentMonth = current >= todayString.slice(0, 7);
  return (
    <div className="calendar">
      <div className="calendar-head">
        <Link className="icon-button calendar-nav" href={href(shiftMonth(year, month, -1))} aria-label="Previous month" scroll={false}><ChevronLeft aria-hidden="true" size={20} /></Link>
        <h3 aria-live="polite">{monthName.format(new Date(`${current}-01T00:00:00Z`))}</h3>
        {isCurrentMonth
          ? <span className="icon-button calendar-nav" aria-disabled="true"><ChevronRight aria-hidden="true" size={20} /></span>
          : <Link className="icon-button calendar-nav" href={href(shiftMonth(year, month, 1))} aria-label="Next month" scroll={false}><ChevronRight aria-hidden="true" size={20} /></Link>}
      </div>
      <table className="calendar-grid">
        <thead><tr>{weekdays.map((day) => <th key={day} scope="col" abbr={day}>{day.slice(0, 2)}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const record = cell.inMonth ? byDate.get(cell.date) : undefined;
                const status = record ? attendanceDisplayStatus(record, today) : null;
                const { label, tone } = status ? statusLabel(status) : { label: "", tone: "gray" as const };
                const detail = record ? `${label}. In ${formatTime(record.timeIn)}, out ${formatTime(record.timeOut)}${record.timeOut ? `, ${hoursBetween(record.timeIn, record.timeOut).toFixed(1)} h` : ""}` : cell.future ? "" : "No record";
                return (
                  <td key={cell.date} className={`calendar-day${cell.inMonth ? "" : " is-outside"}${cell.isToday ? " is-today" : ""}`} data-tone={record ? tone : undefined} title={cell.inMonth ? detail : undefined}>
                    {cell.inMonth && <>
                      <span className="calendar-date">{cell.day}</span>
                      {record && <span className="calendar-status">{label}</span>}
                      <span className="sr-only">{detail}</span>
                    </>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
