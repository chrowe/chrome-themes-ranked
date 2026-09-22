const body = document.querySelector("#themes");
const status = document.querySelector("#status");
const search = document.querySelector("#search");
const sort = document.querySelector("#sort");
const reset = document.querySelector("#reset");
const filters = {
  rating: document.querySelector("#filter-rating"),
  ratingCount: document.querySelector("#filter-count"),
  userCount: document.querySelector("#filter-users")
};
let themes = [];

// An unrated theme has no value to compare, so any active threshold excludes it.
const atLeast = (value, threshold) => !threshold || (value != null && value >= Number(threshold));

const number = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const escape = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const rows = themes.filter((theme) => theme.name.toLocaleLowerCase().includes(query)
    && Object.entries(filters).every(([field, control]) => atLeast(theme[field], control.value)));
  const [key, direction] = sort.value.split("-");
  rows.sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    const field = { count: "ratingCount", users: "userCount" }[key] ?? "rating";
    return ((a[field] ?? -1) - (b[field] ?? -1)) * (direction === "desc" ? -1 : 1) || a.name.localeCompare(b.name);
  });
  body.innerHTML = rows.map((theme, index) => `<tr>
    <td class="rank">${index + 1}</td><td><a class="theme" href="${escape(theme.url)}"><span class="thumb">${theme.image ? `<img src="${escape(theme.image)}" alt="" loading="lazy">` : "◐"}</span><span><strong>${escape(theme.name)}</strong>${theme.author ? `<small>${escape(theme.author)}</small>` : ""}</span></a></td>
    <td><span class="score">${theme.rating == null ? "—" : theme.rating.toFixed(1)}</span><span class="star" aria-hidden="true">★</span></td>
    <td>${theme.ratingCount == null ? "—" : number.format(theme.ratingCount)}</td>
    <td>${theme.userCount == null ? "—" : number.format(theme.userCount)}</td></tr>`).join("");
  const noun = rows.length === 1 ? "theme" : "themes";
  status.textContent = rows.length === themes.length
    ? `${rows.length} ${noun}`
    : `${rows.length} of ${themes.length} ${noun}`;
}

search.addEventListener("input", render);
sort.addEventListener("change", render);
for (const control of Object.values(filters)) control.addEventListener("change", render);
reset.addEventListener("click", () => {
  search.value = "";
  for (const control of Object.values(filters)) control.value = "";
  render();
});

try {
  const response = await fetch("themes.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  themes = (await response.json()).themes;
  render();
} catch (error) {
  status.textContent = `Could not load the theme data: ${error.message}`;
}
