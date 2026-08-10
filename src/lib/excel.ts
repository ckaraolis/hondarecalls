import * as XLSX from "xlsx";

export type ExcelRecallRow = {
  reg_no: string;
  vin_number: string;
  recall_no: string;
  description: string;
  surname: string;
  first_name: string;
  telephone: string;
  done: number;
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
      const match = normalized.find((h) => h.key === "name" || h.key === "first name");
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
 * Prefers named headers, but always falls back to column order:
 * A = Reg. No | B = Vin Number | C = Recall No. | D = Description
 * E = Surname | F = Name | G = Phone number | H = Done
 */
export function parseRecallsExcel(buffer: Buffer): ExcelRecallRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
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
        key.includes("plate") ||
        key.includes("chassis") ||
        key.includes("campaign") ||
        key.includes("surname") ||
        key.includes("owner") ||
        key.includes("phone") ||
        key.includes("mobile") ||
        key.includes("tel") ||
        key.includes("done") ||
        key.includes("completed")
      );
    }) || headerRow.some((h) => !isEmptyHeader(h) && /[a-zA-Zα-ωΑ-Ω]/.test(h));

  const headers = looksLikeHeader
    ? headerRow
    : [
        "Reg. No",
        "Vin Number",
        "Recall No.",
        "Description",
        "Surname",
        "Name",
        "Telephone",
        "Done",
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

  const recallIdx =
    pickColumn(headers, [
      "recall no",
      "recall number",
      "recall",
      "campaign",
      "campaign no",
      "campaign number",
    ]) ?? 2;

  const descIdx =
    pickColumn(headers, [
      "description",
      "discription",
      "details",
      "recall description",
      "περιγραφη",
    ]) ?? 3;

  const surnameIdx =
    pickColumn(headers, [
      "surname",
      "last name",
      "lastname",
      "family name",
      "επιθετο",
    ]) ?? 4;

  const used = new Set<number>([regIdx, vinIdx, recallIdx, descIdx, surnameIdx]);

  const firstNameIdx =
    pickColumn(
      headers,
      ["first name", "firstname", "given name", "name", "ονόμα", "ονομα"],
      used,
    ) ?? 5;

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
    ) ?? 6;

  used.add(phoneIdx);

  const doneIdx =
    pickColumn(
      headers,
      ["done", "completed", "complete", "finished", "status", "ολοκληρωμενο"],
      used,
    ) ?? 7;

  const parsed: ExcelRecallRow[] = [];

  for (const row of rows) {
    const values = Array.isArray(row) ? row : [];
    const reg_no = cell(values[regIdx]);
    const vin_number = cell(values[vinIdx]);
    const recall_no = cell(values[recallIdx]);
    const description = cell(values[descIdx]);
    const surname = cell(values[surnameIdx]);
    const first_name = cell(values[firstNameIdx]);
    const telephone = cell(values[phoneIdx]);
    const done = parseYesNo(values[doneIdx]);

    if (!reg_no && !vin_number) continue;

    parsed.push({
      reg_no,
      vin_number,
      recall_no,
      description,
      surname,
      first_name,
      telephone,
      done,
    });
  }

  if (parsed.length === 0) {
    throw new Error("No valid recall rows found in the Excel file.");
  }

  return parsed;
}
