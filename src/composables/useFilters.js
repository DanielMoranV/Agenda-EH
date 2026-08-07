import { ref } from 'vue'

const filterStatus = ref('Pendiente')
const filterDateType = ref('esta-semana')
const filterDateRange = ref({ start: '', end: '' })
const filterProject = ref('Todos')
const triggerNewTask = ref(false)

export function useFilters() {
  return {
    filterStatus,
    filterDateType,
    filterDateRange,
    filterProject,
    triggerNewTask
  }
}
