const rows = Array.from({length: 15}).map((_, i) => ({ id: `id_${i}` }));
const sections = [];
for (let i = 0; i < rows.length; i += 10) {
  const pageNum = Math.floor(i / 10) + 1;
  if (pageNum > 10) break;
  sections.push({
    title: `Yolcular ${pageNum}`,
    rows: rows.slice(i, i + 10)
  });
}
console.log(JSON.stringify(sections, null, 2));
