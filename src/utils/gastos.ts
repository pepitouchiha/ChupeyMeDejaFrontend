import type { OrigenGasto } from '../api/types'

export const ORIGEN_LABEL: Record<OrigenGasto, string> = {
  manual: 'Manual',
  inventario: 'Inventario',
  nomina: 'Nómina',
}

/** Estilo del chip de una categoría a partir de su color (#rrggbb). */
export function chipStyle(color: string): Record<string, string> {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : '#00e5ff'
  return {
    color: hex,
    backgroundColor: `${hex}1f`,
    borderColor: `${hex}66`,
  }
}
