import butterflyMachineIcon from '@/assets/icons/equipment-butterfly-machine.svg'
import bodyweightIcon from '@/assets/icons/equipment-bodyweight.svg'
import barbellIcon from '@/assets/icons/equipment-barbell.svg'
import hipAdductorIcon from '@/assets/icons/equipment-hip-adductor.svg'
import latPulldownIcon from '@/assets/icons/equipment-lat-pulldown.svg'
import cableMachineIcon from '@/assets/icons/equipment-cable-machine.svg'
import rowingMachineIcon from '@/assets/icons/equipment-rowing-machine.svg'

export const EQUIPMENT_ICON_SLUGS: Record<string, string> = {
  'butterfly-machine': butterflyMachineIcon,
  bodyweight: bodyweightIcon,
  barbell: barbellIcon,
  'hip-adductor': hipAdductorIcon,
  'lat-pulldown': latPulldownIcon,
  'cable-machine': cableMachineIcon,
  'rowing-machine': rowingMachineIcon,
}

export function hasEquipmentIcon(icon?: string): boolean {
  return Boolean(icon && Object.hasOwn(EQUIPMENT_ICON_SLUGS, icon))
}

export function getEquipmentIcon(icon?: string): string | undefined {
  return icon && Object.hasOwn(EQUIPMENT_ICON_SLUGS, icon)
    ? EQUIPMENT_ICON_SLUGS[icon]
    : undefined
}
