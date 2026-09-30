import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportCalendarData = {
  employee: {
    id: string;
    name: string;
    role: string;
    workingDays: number[];
  };
  departmentName: string;
  year: number;
  month: number; // 1-12
  attendance: Array<{
    id: string;
    date: string; // YYYY-MM-DD
    status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF_DAY";
    note: string | null;
  }>;
  infractions: Array<{
    id: string;
    date: string; // YYYY-MM-DD
    type: "MINOR" | "MAJOR" | "MISCELLANEOUS";
    description: string | null;
    amount: number;
  }>;
  penaltyRules: Array<{
    key: string;
    label: string;
    amount: number;
  }>;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

type ProcessedDay = {
  dayNumber: number;
  dayOfWeek: number;
  dateStr: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "OFF" | "UNSET";
  note: string | null;
  infractions: Array<{ type: string; description: string | null; amount: number }>;
  lateDeduction: number;
  absenceDeduction: number;
  infractionDeduction: number;
  totalDayDeduction: number;
  isBlank: boolean;
};

type ItemizedDeduction = {
  date: string;
  dayOfWeekName: string;
  category: "LATE" | "ABSENT" | "INFRACTION";
  label: string;
  description: string;
  amount: number;
};

function processCalendarData(data: ExportCalendarData) {
  const { employee, year, month, attendance, infractions, penaltyRules } = data;
  const monthName = MONTH_NAMES[month - 1] ?? `Month ${month}`;

  const ruleMap = Object.fromEntries(penaltyRules.map((r) => [r.key, r]));
  const latePenalty = ruleMap.LATE?.amount ?? 10000;
  const absentPenalty = ruleMap.ABSENT?.amount ?? 50000;

  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const attMap = new Map(attendance.map((a) => [a.date, a]));
  const infMap = new Map<string, Array<{ type: string; description: string | null; amount: number }>>();
  for (const inf of infractions) {
    const list = infMap.get(inf.date) ?? [];
    list.push(inf);
    infMap.set(inf.date, list);
  }

  const calendarDays: ProcessedDay[] = [];
  const itemizedDeductions: ItemizedDeduction[] = [];

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
    const isWorkingDay = employee.workingDays.includes(dayOfWeek);

    const att = attMap.get(dateStr);
    const dayInfs = infMap.get(dateStr) ?? [];

    let status: ProcessedDay["status"] = "UNSET";
    if (att) {
      status = att.status === "OFF_DAY" ? "OFF" : (att.status as any);
    } else if (!isWorkingDay) {
      status = "OFF";
    }

    let lateDeduction = 0;
    let absenceDeduction = 0;
    if (status === "LATE") {
      lateDeduction = latePenalty;
      itemizedDeductions.push({
        date: dateStr,
        dayOfWeekName: WEEKDAY_NAMES_FULL[dayOfWeek],
        category: "LATE",
        label: ruleMap.LATE?.label ?? "Late Attendance Penalty",
        description: att?.note ? `Note: "${att.note}"` : "Arrived after scheduled start time",
        amount: latePenalty,
      });
    } else if (status === "ABSENT") {
      absenceDeduction = absentPenalty;
      itemizedDeductions.push({
        date: dateStr,
        dayOfWeekName: WEEKDAY_NAMES_FULL[dayOfWeek],
        category: "ABSENT",
        label: ruleMap.ABSENT?.label ?? "Absence Penalty",
        description: att?.note ? `Note: "${att.note}"` : "Unexcused absence on scheduled workday",
        amount: absentPenalty,
      });
    }

    const infractionDeduction = dayInfs.reduce((sum, i) => sum + i.amount, 0);
    for (const inf of dayInfs) {
      const infRule =
        inf.type === "MINOR"
          ? ruleMap.MINOR_INFRACTION
          : inf.type === "MAJOR"
          ? ruleMap.MAJOR_INFRACTION
          : null;
      itemizedDeductions.push({
        date: dateStr,
        dayOfWeekName: WEEKDAY_NAMES_FULL[dayOfWeek],
        category: "INFRACTION",
        label:
          infRule?.label ??
          (inf.type === "MINOR"
            ? "Minor Infraction"
            : inf.type === "MAJOR"
            ? "Major Infraction"
            : "Infraction"),
        description: inf.description || "Workplace violation / infraction",
        amount: inf.amount,
      });
    }

    const totalDayDeduction = lateDeduction + absenceDeduction + infractionDeduction;

    calendarDays.push({
      dayNumber: day,
      dayOfWeek,
      dateStr,
      status,
      note: att?.note ?? null,
      infractions: dayInfs,
      lateDeduction,
      absenceDeduction,
      infractionDeduction,
      totalDayDeduction,
      isBlank: false,
    });
  }

  // Weeks partitioning for 7-column layout (Sunday=0 to Saturday=6)
  const weeks: ProcessedDay[][] = [];
  let currentWeek: ProcessedDay[] = [];

  // Leading blanks
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({
      dayNumber: 0,
      dayOfWeek: i,
      dateStr: "",
      status: "UNSET",
      note: null,
      infractions: [],
      lateDeduction: 0,
      absenceDeduction: 0,
      infractionDeduction: 0,
      totalDayDeduction: 0,
      isBlank: true,
    });
  }

  for (const d of calendarDays) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Trailing blanks
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({
        dayNumber: 0,
        dayOfWeek: currentWeek.length,
        dateStr: "",
        status: "UNSET",
        note: null,
        infractions: [],
        lateDeduction: 0,
        absenceDeduction: 0,
        infractionDeduction: 0,
        totalDayDeduction: 0,
        isBlank: true,
      });
    }
    weeks.push(currentWeek);
  }

  const presentCount = calendarDays.filter((d) => d.status === "PRESENT").length;
  const lateCount = calendarDays.filter((d) => d.status === "LATE").length;
  const absentCount = calendarDays.filter((d) => d.status === "ABSENT").length;
  const excusedCount = calendarDays.filter((d) => d.status === "EXCUSED").length;
  const offCount = calendarDays.filter((d) => d.status === "OFF").length;

  const cashFromLate = lateCount * latePenalty;
  const cashFromAbsent = absentCount * absentPenalty;
  const cashFromInfractions = infractions.reduce((sum, i) => sum + i.amount, 0);
  const grandTotalDeductions = cashFromLate + cashFromAbsent + cashFromInfractions;

  const totalMarkedDuty = presentCount + lateCount + absentCount;
  const attendanceRate = totalMarkedDuty > 0 ? Math.round((presentCount / totalMarkedDuty) * 100) : null;

  return {
    monthName,
    calendarDays,
    weeks,
    itemizedDeductions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    offCount,
    cashFromLate,
    cashFromAbsent,
    cashFromInfractions,
    grandTotalDeductions,
    attendanceRate,
    latePenalty,
    absentPenalty,
  };
}

/**
 * Generate an Excel (.xlsx) workbook for the employee's monthly calendar and deductions
 */
export async function generateEmployeeCalendarExcel(data: ExportCalendarData): Promise<Buffer> {
  const processed = processCalendarData(data);
  const { employee, departmentName, year } = data;
  const {
    monthName,
    weeks,
    itemizedDeductions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    offCount,
    cashFromLate,
    cashFromAbsent,
    cashFromInfractions,
    grandTotalDeductions,
    attendanceRate,
  } = processed;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Attendance System";
  wb.created = new Date();

  const ws = wb.addWorksheet(`${monthName.slice(0, 3)} ${year} Calendar`);

  // Column widths for 7 days
  for (let col = 1; col <= 7; col++) {
    ws.getColumn(col).width = 25;
  }

  // Row 1: Header title banner
  ws.mergeCells("A1:G1");
  const r1 = ws.getCell("A1");
  r1.value = `${departmentName} - Monthly Attendance & Deductions Calendar`;
  r1.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Row 2: Subtitle with Employee name, role, and period
  ws.mergeCells("A2:G2");
  const r2 = ws.getCell("A2");
  r2.value = `Employee: ${employee.name}   |   Role: ${employee.role}   |   Period: ${monthName} ${year}`;
  r2.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 24;

  // Row 3: Blank separator
  ws.getRow(3).height = 10;

  // Row 4: Summary KPIs
  ws.getRow(4).height = 30;
  const kpiData = [
    `Present: ${presentCount} (${attendanceRate !== null ? `${attendanceRate}%` : "—"})`,
    `Late: ${lateCount} (-₦${cashFromLate.toLocaleString()})`,
    `Absent: ${absentCount} (-₦${cashFromAbsent.toLocaleString()})`,
    `Excused: ${excusedCount}`,
    `Off Days: ${offCount}`,
    `Infractions: ${data.infractions.length} (-₦${cashFromInfractions.toLocaleString()})`,
    `Total Deductions: -₦${grandTotalDeductions.toLocaleString()}`,
  ];

  kpiData.forEach((val, idx) => {
    const c = ws.getRow(4).getCell(idx + 1);
    c.value = val;
    const isTotal = idx === 6;
    c.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: isTotal ? "FFB91C1C" : "FF1F2937" },
    };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isTotal ? "FFFEE2E2" : "FFF3F4F6" },
    };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  // Row 5: Blank separator
  ws.getRow(5).height = 10;

  // Row 6: Weekday Column Headers
  ws.getRow(6).height = 24;
  ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].forEach((dayName, idx) => {
    const c = ws.getRow(6).getCell(idx + 1);
    c.value = dayName;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = {
      top: { style: "thin", color: { argb: "FF4B5563" } },
      bottom: { style: "thin", color: { argb: "FF4B5563" } },
      left: { style: "thin", color: { argb: "FF4B5563" } },
      right: { style: "thin", color: { argb: "FF4B5563" } },
    };
  });

  // Calendar Weeks
  let rowIdx = 7;
  for (const week of weeks) {
    const headRow = ws.getRow(rowIdx);
    headRow.height = 22;

    const detRow = ws.getRow(rowIdx + 1);
    detRow.height = 42;

    week.forEach((day, colIdx) => {
      const col = colIdx + 1;
      const headCell = headRow.getCell(col);
      const detCell = detRow.getCell(col);

      if (day.isBlank) {
        headCell.value = "";
        detCell.value = "";
        headCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        detCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      } else {
        headCell.value = `Day ${day.dayNumber}   [ ${day.status} ]`;
        headCell.font = { name: "Calibri", size: 10, bold: true };
        headCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

        let fgColor = "FFFFFFFF";
        let fontColor = "FF111827";

        if (day.status === "PRESENT") {
          fgColor = "FFDCFCE7";
          fontColor = "FF166534";
        } else if (day.status === "LATE") {
          fgColor = "FFFEF3C7";
          fontColor = "FF92400E";
        } else if (day.status === "ABSENT") {
          fgColor = "FFFEE2E2";
          fontColor = "FF991B1B";
        } else if (day.status === "EXCUSED") {
          fgColor = "FFF3E8FF";
          fontColor = "FF6B21A8";
        } else if (day.status === "OFF") {
          fgColor = "FFF3F4F6";
          fontColor = "FF4B5563";
        }

        headCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fgColor } };
        headCell.font.color = { argb: fontColor };

        // Detail / deductions text
        const details: string[] = [];
        if (day.lateDeduction > 0) details.push(`⚠️ Late: -₦${day.lateDeduction.toLocaleString()}`);
        if (day.absenceDeduction > 0) details.push(`❌ Absent: -₦${day.absenceDeduction.toLocaleString()}`);
        for (const inf of day.infractions) {
          details.push(`🚨 Inf: -₦${inf.amount.toLocaleString()} (${inf.description || inf.type})`);
        }
        if (day.note) details.push(`Note: ${day.note}`);

        if (details.length === 0) {
          if (day.status === "PRESENT") details.push("✓ Full Duty Attended");
          else if (day.status === "OFF") details.push("Off / Rest Day");
          else if (day.status === "EXCUSED") details.push("Excused Leave");
          else details.push("—");
        }

        detCell.value = details.join("\n");
        const hasDeductions = day.totalDayDeduction > 0;
        detCell.font = {
          name: "Calibri",
          size: 9,
          bold: hasDeductions,
          color: { argb: hasDeductions ? "FFB91C1C" : "FF4B5563" },
        };
        detCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hasDeductions ? "FFFFF5F5" : "FFFFFFFF" },
        };
        detCell.alignment = { horizontal: "left", vertical: "top", wrapText: true, indent: 1 };
      }

      const borderStyle = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
      headCell.border = { top: borderStyle, left: borderStyle, right: borderStyle };
      detCell.border = { bottom: borderStyle, left: borderStyle, right: borderStyle };
    });

    rowIdx += 2;
  }

  // Row gap before Itemized Deductions Table
  rowIdx++;

  // Itemized Deductions Header
  ws.mergeCells(`A${rowIdx}:G${rowIdx}`);
  const dedHeader = ws.getCell(`A${rowIdx}`);
  dedHeader.value = `ITEMIZED DEDUCTIONS & PENALTIES - ${monthName.toUpperCase()} ${year}`;
  dedHeader.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  dedHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };
  dedHeader.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(rowIdx).height = 24;
  rowIdx++;

  // Itemized Deductions Column Headers
  const colRow = ws.getRow(rowIdx);
  colRow.height = 22;
  ws.mergeCells(`D${rowIdx}:F${rowIdx}`);
  colRow.getCell(1).value = "Date";
  colRow.getCell(2).value = "Day";
  colRow.getCell(3).value = "Category";
  colRow.getCell(4).value = "Description / Reason";
  colRow.getCell(7).value = "Amount (₦)";

  [1, 2, 3, 4, 7].forEach((col) => {
    const c = colRow.getCell(col);
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1F2937" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    c.alignment = { horizontal: col === 7 ? "right" : "left", vertical: "middle" };
    c.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  rowIdx++;

  if (itemizedDeductions.length === 0) {
    ws.mergeCells(`A${rowIdx}:G${rowIdx}`);
    const noDed = ws.getCell(`A${rowIdx}`);
    noDed.value = `No attendance penalties or infractions recorded for this employee in ${monthName} ${year}.`;
    noDed.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF6B7280" } };
    noDed.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(rowIdx).height = 22;
    rowIdx++;
  } else {
    for (const d of itemizedDeductions) {
      const r = ws.getRow(rowIdx);
      r.height = 20;
      ws.mergeCells(`D${rowIdx}:F${rowIdx}`);

      r.getCell(1).value = d.date;
      r.getCell(2).value = d.dayOfWeekName;
      r.getCell(3).value = d.category;
      r.getCell(4).value = `${d.label}${d.description ? ` (${d.description})` : ""}`;
      r.getCell(7).value = d.amount;
      r.getCell(7).numFmt = '"₦"#,##0';

      [1, 2, 3, 4, 7].forEach((col) => {
        const c = r.getCell(col);
        c.font = {
          name: "Calibri",
          size: 9.5,
          color: { argb: col === 7 ? "FFB91C1C" : "FF111827" },
          bold: col === 7,
        };
        c.alignment = { horizontal: col === 7 ? "right" : "left", vertical: "middle" };
        c.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
      rowIdx++;
    }
  }

  // Total Deductions Summary Row
  const totalRow = ws.getRow(rowIdx);
  totalRow.height = 24;
  ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
  const lblTotal = totalRow.getCell(1);
  lblTotal.value = "TOTAL DEDUCTIONS";
  lblTotal.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF991B1B" } };
  lblTotal.alignment = { horizontal: "right", vertical: "middle" };
  lblTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

  const valTotal = totalRow.getCell(7);
  valTotal.value = grandTotalDeductions;
  valTotal.numFmt = '"₦"#,##0';
  valTotal.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF991B1B" } };
  valTotal.alignment = { horizontal: "right", vertical: "middle" };
  valTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

  [1, 7].forEach((col) => {
    const c = totalRow.getCell(col);
    c.border = {
      top: { style: "thin", color: { argb: "FFB91C1C" } },
      bottom: { style: "double", color: { argb: "FFB91C1C" } },
      left: { style: "thin", color: { argb: "FFB91C1C" } },
      right: { style: "thin", color: { argb: "FFB91C1C" } },
    };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate a PDF (.pdf) document for the employee's monthly calendar and deductions
 */
export async function generateEmployeeCalendarPdf(data: ExportCalendarData): Promise<Buffer> {
  const processed = processCalendarData(data);
  const { employee, departmentName, year } = data;
  const {
    monthName,
    weeks,
    itemizedDeductions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    offCount,
    cashFromLate,
    cashFromAbsent,
    cashFromInfractions,
    grandTotalDeductions,
    attendanceRate,
  } = processed;

  // A4 Landscape: width = 841.89 pt, height = 595.28 pt
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // 1. Header Banner
  doc.setFillColor(30, 58, 138); // Deep Blue #1E3A8A
  doc.rect(30, 18, 781.89, 44, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${departmentName} - Monthly Attendance & Deductions Calendar`, 40, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    `Employee: ${employee.name}   |   Role: ${employee.role}   |   Period: ${monthName} ${year}`,
    40,
    52
  );

  // 2. Summary KPI Bar
  const kpiLabels = [
    `Present: ${presentCount} (${attendanceRate !== null ? `${attendanceRate}%` : "—"})`,
    `Late: ${lateCount} (-NGN ${cashFromLate.toLocaleString()})`,
    `Absent: ${absentCount} (-NGN ${cashFromAbsent.toLocaleString()})`,
    `Excused: ${excusedCount}`,
    `Off Days: ${offCount}`,
    `Infractions: ${data.infractions.length} (-NGN ${cashFromInfractions.toLocaleString()})`,
    `Total Deductions: -NGN ${grandTotalDeductions.toLocaleString()}`,
  ];

  autoTable(doc, {
    startY: 68,
    margin: { left: 30, right: 30 },
    head: [kpiLabels],
    body: [],
    theme: "plain",
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [31, 41, 55],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: 4,
      lineColor: [209, 213, 219],
      lineWidth: 0.5,
    },
    didParseCell: (hookData) => {
      if (hookData.column.index === 6) {
        hookData.cell.styles.fillColor = [254, 226, 226];
        hookData.cell.styles.textColor = [185, 28, 28];
      }
    },
  });

  // 3. Calendar Grid Table
  const calendarY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : 96;

  const pdfCalendarBody = weeks.map((week) =>
    week.map((d) => {
      if (d.isBlank) return "";
      const lines = [`Day ${d.dayNumber} [${d.status}]`];
      if (d.lateDeduction > 0) lines.push(`Late: -NGN ${d.lateDeduction.toLocaleString()}`);
      if (d.absenceDeduction > 0) lines.push(`Absent: -NGN ${d.absenceDeduction.toLocaleString()}`);
      for (const inf of d.infractions) {
        lines.push(`Inf: -NGN ${inf.amount.toLocaleString()}`);
      }
      if (d.note) lines.push(`Note: ${d.note}`);
      return lines.join("\n");
    })
  );

  autoTable(doc, {
    startY: calendarY,
    margin: { left: 30, right: 30 },
    head: [["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]],
    body: pdfCalendarBody,
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      minCellHeight: 44,
      overflow: "linebreak",
      valign: "top",
      lineColor: [209, 213, 219],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
      cellPadding: 4,
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body") {
        const week = weeks[hookData.row.index];
        const day = week?.[hookData.column.index];
        if (day && !day.isBlank) {
          if (day.status === "PRESENT") {
            hookData.cell.styles.fillColor = [236, 253, 245];
            hookData.cell.styles.textColor = [22, 101, 52];
          } else if (day.status === "LATE") {
            hookData.cell.styles.fillColor = [254, 243, 199];
            hookData.cell.styles.textColor = [146, 64, 14];
          } else if (day.status === "ABSENT") {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [153, 27, 27];
          } else if (day.status === "EXCUSED") {
            hookData.cell.styles.fillColor = [243, 232, 255];
            hookData.cell.styles.textColor = [107, 33, 168];
          } else if (day.status === "OFF") {
            hookData.cell.styles.fillColor = [243, 244, 246];
            hookData.cell.styles.textColor = [75, 85, 99];
          }
          if (day.totalDayDeduction > 0) {
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  const finalGridY = (doc as any).lastAutoTable?.finalY ?? 400;

  // 4. Itemized Deductions Table
  // If remaining space on page 1 is too small for deductions table (needs ~120pt), start on page 2
  if (finalGridY + 110 > 560) {
    doc.addPage();
  }

  const dedStartY = doc.getNumberOfPages() > 1 && finalGridY + 110 > 560 ? 30 : finalGridY + 14;

  const dedBody =
    itemizedDeductions.length > 0
      ? itemizedDeductions.map((d) => [
          d.date,
          d.dayOfWeekName,
          d.category,
          `${d.label}${d.description ? ` (${d.description})` : ""}`,
          `NGN ${d.amount.toLocaleString()}`,
        ])
      : [["—", "—", "None", `No deductions recorded for ${monthName} ${year}.`, "NGN 0"]];

  autoTable(doc, {
    startY: dedStartY,
    margin: { left: 30, right: 30 },
    head: [["Date", "Day", "Category", "Description / Reason", "Deduction Amount"]],
    body: dedBody,
    foot: [["Total Deductions", "", "", "", `NGN ${grandTotalDeductions.toLocaleString()}`]],
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3.5,
    },
    footStyles: {
      fillColor: [254, 226, 226],
      textColor: [185, 28, 28],
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 4,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 65 },
      2: { cellWidth: 75 },
      4: { halign: "right", cellWidth: 95 },
    },
  });

  // 5. Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} | Attendance & Payroll System`,
      30,
      580
    );
    doc.text(`Page ${i} of ${totalPages}`, 780, 580, { align: "right" });
  }

  const pdfArrayBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfArrayBuffer);
}
