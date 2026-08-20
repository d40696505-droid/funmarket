// FR-6.4: базовый фильтр нецензурной лексики по словарю.
// Список — стартовый набор, для продакшена стоит вынести в конфигурацию
// и расширить словарь модерации.
const BLOCKED_ROOTS = ['хуй', 'пизд', 'ебат', 'ебан', 'бляд', 'сука', 'мудак'];

export function censorProfanity(text: string): string {
  let result = text;
  for (const root of BLOCKED_ROOTS) {
    const pattern = new RegExp(root, 'gi');
    result = result.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return result;
}
