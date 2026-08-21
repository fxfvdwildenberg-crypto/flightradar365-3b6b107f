/**
 * Chart sources for PTFS airports.
 *
 * PTFS.app hosts official ground charts as images per ICAO, and AeroNav
 * publishes the full procedure chart sets in their web app.
 */

/** ICAOs that have an official PTFS.app ground chart image. */
export const GROUND_CHART_ICAOS = [
  "IBAR",
  "IBLT",
  "IBRD",
  "IBTH",
  "IDCS",
  "IGAR",
  "IHEN",
  "IIAB",
  "IJAF",
  "IKFL",
  "ILAR",
  "ILKL",
  "IMLR",
  "IPAP",
  "IPPH",
  "IRFD",
  "ISAU",
  "ISCM",
  "ISKP",
  "ITEY",
  "ITKO",
  "ITRC",
  "IUFO",
  "IZOL",
];

export type ChartLink = {
  key: string;
  label: string;
  kind: "image" | "link";
  url: string;
};

const groundChartUrl = (icao: string, theme: "dark" | "light" = "dark") =>
  `https://ptfs.app/charts/${theme}/${encodeURIComponent(`${icao} Ground Chart.png`)}`;

/** Every chart we can offer for one airport. */
export function chartsFor(icao: string): ChartLink[] {
  const code = icao.toUpperCase();
  const list: ChartLink[] = [];

  if (GROUND_CHART_ICAOS.includes(code)) {
    list.push({
      key: "ground-dark",
      label: `${code} Ground Chart`,
      kind: "image",
      url: groundChartUrl(code, "dark"),
    });
    list.push({
      key: "ground-light",
      label: `${code} Ground Chart (light)`,
      kind: "link",
      url: groundChartUrl(code, "light"),
    });
  }

  list.push({
    key: "aeronav",
    label: `AeroNav procedures — ${code}`,
    kind: "link",
    url: `https://aeronav.space/app?icao=${code}`,
  });
  list.push({
    key: "ptfs",
    label: "All PTFS.app charts",
    kind: "link",
    url: "https://ptfs.app/charts",
  });

  return list;
}
