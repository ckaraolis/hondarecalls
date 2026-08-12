import * as XLSX from "xlsx";

export type ExcelRecallRow = {
  reg_no: string;
  vin_number: string;
  model: string;
  recall_no: string;
  description: string;
  part_number: string;
  surname: string;
  first_name: string;
  telephone: string;
  city: string;
  done: number;
  registration_date: string;
  engine_number: string;
};

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseYesNo(value: unknown): number {
  const raw = cell(value).toLowerCase();
  if (!raw) return 0;
  return raw === "yes" ||
    raw === "y" ||
    raw === "true" ||
    raw === "1" ||
    raw === "done" ||
    raw === "ναι"
    ? 1
    : 0;
}

function parseDateCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const raw = cell(value);
  if (!raw) return "";
  // Keep readable text as-is (DD/MM/YYYY, etc.)
  return raw;
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width / BOM
    .replace(/[._\-_/\\()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyHeader(header: string) {
  const key = normalizeHeader(header);
  return !key || key.startsWith("__empty");
}

function pickColumn(
  headers: string[],
  aliases: string[],
  exclude: Set<number> = new Set(),
): number | undefined {
  const normalized = headers
    .map((h, index) => ({
      index,
      key: normalizeHeader(h),
    }))
    .filter((h) => !exclude.has(h.index));

  for (const alias of aliases) {
    const match = normalized.find((h) => h.key === alias);
    if (match) return match.index;
  }

  for (const alias of aliases) {
    // Avoid matching "surname" when looking for "name".
    if (alias === "name") {
      const match = normalized.find(
        (h) => h.key === "name" || h.key === "first name",
      );
      if (match) return match.index;
      continue;
    }
    const match = normalized.find(
      (h) => h.key.includes(alias) || alias.includes(h.key),
    );
    if (match && match.key.length > 0) return match.index;
  }

  return undefined;
}

/**
 * Reads recalls from Excel/CSV.
 * Prefers named headers. Expected template columns:
 * Reg. No | Vin Number | Model | Recall No. | Description | Part Number |
 * Surname | Name | Telephone | City | Done | Registration Date | Engine Number
 */
export function parseRecallsExcel(buffer: Buffer): ExcelRecallRow[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    cellDates: true,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    },
  );

  if (matrix.length === 0) {
    throw new Error("Excel sheet is empty.");
  }

  const headerRow = (matrix[0] ?? []).map((value) => cell(value));
  const dataRows = matrix.slice(1);

  const looksLikeHeader =
    headerRow.some((h) => {
      const key = normalizeHeader(h);
      return (
        key.includes("reg") ||
        key.includes("vin") ||
        key.includes("recall") ||
        key.includes("desc") ||
        key.includes("model") ||
        key.includes("part") ||
        key.includes("plate") ||
        key.includes("chassis") ||
        key.includes("campaign") ||
        key.includes("surname") ||
        key.includes("owner") ||
        key.includes("phone") ||
        key.includes("mobile") ||
        key.includes("tel") ||
        key.includes("city") ||
        key.includes("engine") ||
        key.includes("done") ||
        key.includes("completed")
      );
    }) || headerRow.some((h) => !isEmptyHeader(h) && /[a-zA-Zα-ωΑ-Ω]/.test(h));

  const headers = looksLikeHeader
    ? headerRow
    : [
        "Reg. No",
        "Vin Number",
        "Model",
        "Recall No.",
        "Description",
        "Part Number",
        "Surname",
        "Name",
        "Telephone",
        "City",
        "Done",
        "Registration Date",
        "Engine Number",
      ];
  const rows = looksLikeHeader ? dataRows : matrix;

  const regIdx =
    pickColumn(headers, [
      "reg no",
      "regno",
      "reg",
      "registration",
      "registration no",
      "registration number",
      "vehicle reg",
      "vehicle registration",
      "plate",
      "plate no",
      "plate number",
      "car number",
      "car no",
      "number plate",
      "αρ κυκλοφοριας",
      "αριθμος κυκλοφοριας",
      "πινακιδα",
    ]) ?? 0;

  const vinIdx =
    pickColumn(headers, [
      "vin number",
      "vin no",
      "vin",
      "chassis",
      "chassis no",
      "chassis number",
      "frame no",
      "πλαισιο",
      "αριθμος πλαισιου",
    ]) ?? 1;

  const modelIdx =
    pickColumn(headers, ["model", "vehicle model", "car model", "μοντελο"]) ??
    2;

  const recallIdx =
    pickColumn(headers, [
      "recall no",
      "recall number",
      "recall",
      "campaign",
      "campaign no",
      "campaign number",
    ]) ?? 3;

  const descIdx =
    pickColumn(headers, [
      "description",
      "discription",
      "details",
      "recall description",
      "περιγραφη",
    ]) ?? 4;

  const partIdx =
    pickColumn(headers, [
      "part number",
      "part no",
      "part",
      "parts",
      "αριθμος ανταλλακτικου",
    ]) ?? 5;

  const surnameIdx =
    pickColumn(headers, [
      "surname",
      "last name",
      "lastname",
      "family name",
      "επιθετο",
    ]) ?? 6;

  const used = new Set<number>([
    regIdx,
    vinIdx,
    modelIdx,
    recallIdx,
    descIdx,
    partIdx,
    surnameIdx,
  ]);

  const firstNameIdx =
    pickColumn(
      headers,
      ["first name", "firstname", "given name", "name", "ονόμα", "ονομα"],
      used,
    ) ?? 7;

  used.add(firstNameIdx);

  const phoneIdx =
    pickColumn(
      headers,
      [
        "telephone",
        "phone",
        "phone number",
        "mobile",
        "mobile number",
        "tel",
        "cell",
        "τηλεφωνο",
        "κινητο",
      ],
      used,
    ) ?? 8;

  used.add(phoneIdx);

  const cityIdx =
    pickColumn(headers, ["city", "town", "πολη"], used) ?? 9;
  used.add(cityIdx);

  const doneIdx =
    pickColumn(
      headers,
      ["done", "completed", "complete", "finished", "status", "ολοκληρωμενο"],
      used,
    ) ?? 10;
  used.add(doneIdx);

  const registrationDateIdx =
    pickColumn(
      headers,
      [
        "registration date",
        "reg date",
        "date registered",
        "registered date",
        "ημ εγγραφης",
        "ημερομηνια εγγραφης",
      ],
      used,
    ) ?? 11;
  used.add(registrationDateIdx);

  const engineIdx =
    pickColumn(
      headers,
      [
        "engine number",
        "engine no",
        "engine",
        "motor number",
        "αριθμος κινητηρα",
      ],
      used,
    ) ?? 12;

  const parsed: ExcelRecallRow[] = [];

  for (const row of rows) {
    const values = Array.isArray(row) ? row : [];
    const reg_no = cell(values[regIdx]);
    const vin_number = cell(values[vinIdx]);
    const model = cell(values[modelIdx]);
    const recall_no = cell(values[recallIdx]);
    const description = cell(values[descIdx]);
    const part_number = cell(values[partIdx]);
    const surname = cell(values[surnameIdx]);
    const first_name = cell(values[firstNameIdx]);
    const telephone = cell(values[phoneIdx]);
    const city = cell(values[cityIdx]);
    const done = parseYesNo(values[doneIdx]);
    const registration_date = parseDateCell(values[registrationDateIdx]);
    const engine_number = cell(values[engineIdx]);

    if (!reg_no && !vin_number) continue;

    parsed.push({
      reg_no,
      vin_number,
      model,
      recall_no,
      description,
      part_number,
      surname,
      first_name,
      telephone,
      city,
      done,
      registration_date,
      engine_number,
    });
  }

  if (parsed.length === 0) {
    throw new Error("No valid recall rows found in the Excel file.");
  }

  return parsed;
}
