import { fireEvent, screen, within } from "@testing-library/react";

/** Sidebar section that holds each view, by its Mongolian label. */
const SECTION: Record<string, string> = {
  // Single-view sections are labelled with the view itself.
  "Миний өрөө": "Миний өрөө",
  "Миний мэдлэг": "Суралцах",
  Календарь: "Суралцах",
  Хичээлүүд: "Суралцах",
  Статистик: "Ахиц",
  Зорилго: "Ахиц",
  Амжилт: "Ахиц",
  "Суралцах туслах": "Суралцах туслах",
  Тохиргоо: "Тохиргоо",
  "Өрөөний загвар": "Тохиргоо",
  "Нууцлал ба өгөгдөл": "Тохиргоо",
};

/**
 * Opens a view through the grouped sidebar: the section button first, then the
 * sub-item when the section holds several views.
 */
export function openView(label: string) {
  const nav = screen.getByRole("navigation", { name: "Миний орон зай" });
  const section = SECTION[label] ?? label;
  fireEvent.click(within(nav).getByRole("button", { name: section }));
  const sub = screen.queryByRole("group", { name: section });
  if (sub) fireEvent.click(within(sub).getByRole("button", { name: label }));
}
