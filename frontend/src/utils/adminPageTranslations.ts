// 🌍 Admin Pages Translations
// Traduzioni per le pagine amministrative

export type SupportedLanguage = "IT" | "EN" | "ES" | "PT"

export interface AdminPageTexts {
  // Analytics Page
  analyticsTitle: string
  analyticsSubtitle: string
  noWorkspace: string
  retry: string
  loadingError: string
  dataError: string
  topProducts: string
  topCustomers: string
  topSellers: string
  noProductData: string
  noCustomerData: string
  noSellerData: string
  noAnalyticsData: string
  stock: string
  sold: string
  orders: string
  average: string
  format: string

  // Metrics Overview
  mainMetrics: string
  totalOrders: string
  clients: string
  messages: string
  llmCost: string
  totalOrdersDesc: string
  activeClientsDesc: string
  messagesDesc: string

  // Trends
  increase: string
  decrease: string
  unchanged: string

  // Date Range Selector
  lastWeek: string
  lastWeekDesc: string
  last30Days: string
  last30DaysDesc: string
  last3Months: string
  last3MonthsDesc: string
  last6Months: string
  last6MonthsDesc: string
  lastYear: string
  lastYearDesc: string

  // Historical Chart
  historicalTrends: string
  historicalTrendsDesc: string
  ordersLabel: string
  totalOrdersLabel: string
  activeClients: string
  totalRevenue: string

  // Common
  loading: string
  error: string
  success: string
  cancel: string
  save: string
  delete: string
  edit: string
  confirm: string
  back: string

  // Dashboard
  dashboard: string
  overview: string
  metrics: string
  reports: string
}

export const adminPageTranslations: Record<SupportedLanguage, AdminPageTexts> =
  {
    IT: {
      // Analytics Page
      analyticsTitle: "Analytics Dashboard",
      analyticsSubtitle:
        "Monitora le prestazioni e le metriche di crescita del tuo business",
      noWorkspace: "Nessun workspace selezionato",
      retry: "Riprova",
      loadingError: "Impossibile caricare i dati analytics",
      dataError: "Errore nel caricamento dei dati analytics",
      topProducts: "Prodotti Top",
      topCustomers: "Clienti Top",
      topSellers: "Venditori Top",
      noProductData: "Nessun dato di vendita prodotti disponibile",
      noCustomerData: "Nessun dato cliente disponibile",
      noSellerData: "Nessun dato venditore disponibile",
      noAnalyticsData: "Nessun dato analytics disponibile",
      stock: "Scorte",
      sold: "venduti",
      orders: "ordini",
      average: "Media",
      format: "Format",

      // Metrics Overview
      mainMetrics: "Metriche Principali",
      totalOrders: "Ordini Totali",
      clients: "Clienti",
      messages: "Messaggi",
      llmCost: "Costo LLM",
      totalOrdersDesc: "Numero totale di ordini ricevuti",
      activeClientsDesc: "Numero di clienti attivi",
      messagesDesc: "Messaggi scambiati con i clienti",

      // Trends
      increase: "in più",
      decrease: "in meno",
      unchanged: "invariato",

      // Date Range Selector
      lastWeek: "Ultima Settimana",
      lastWeekDesc: "Ultimi 7 giorni",
      last30Days: "Ultimi 30 Giorni",
      last30DaysDesc: "Ultimi 30 giorni",
      last3Months: "Ultimi 3 Mesi",
      last3MonthsDesc: "Ultimi 90 giorni",
      last6Months: "Ultimi 6 Mesi",
      last6MonthsDesc: "Ultimi 180 giorni",
      lastYear: "Ultimo Anno",
      lastYearDesc: "Ultimi 365 giorni",

      // Historical Chart
      historicalTrends: "Andamenti Storici - Ordini, Ricavi e Costi LLM",
      historicalTrendsDesc:
        "Evoluzione delle prestazioni nel periodo selezionato incluso il monitoraggio dei costi AI",
      ordersLabel: "Ordini",
      totalOrdersLabel: "Ordini Totali",
      activeClients: "Clienti Attivi",
      totalRevenue: "Ricavi Totali",

      // Common
      loading: "Caricamento...",
      error: "Errore",
      success: "Successo",
      cancel: "Annulla",
      save: "Salva",
      delete: "Elimina",
      edit: "Modifica",
      confirm: "Conferma",
      back: "Indietro",

      // Dashboard
      dashboard: "Dashboard",
      overview: "Panoramica",
      metrics: "Metriche",
      reports: "Report",
    },
    EN: {
      // Analytics Page
      analyticsTitle: "Analytics Dashboard",
      analyticsSubtitle: "Monitor your business performance and growth metrics",
      noWorkspace: "No workspace selected",
      retry: "Retry",
      loadingError: "Unable to load analytics data",
      dataError: "Error loading analytics data",
      topProducts: "Top Products",
      topCustomers: "Top Customers",
      topSellers: "Top Sellers",
      noProductData: "No product sales data available",
      noCustomerData: "No customer data available",
      noSellerData: "No seller data available",
      noAnalyticsData: "No analytics data available",
      stock: "Stock",
      sold: "sold",
      orders: "orders",
      average: "Average",
      format: "Format",

      // Metrics Overview
      mainMetrics: "Main Metrics",
      totalOrders: "Total Orders",
      clients: "Clients",
      messages: "Messages",
      llmCost: "LLM Cost",
      totalOrdersDesc: "Total number of orders received",
      activeClientsDesc: "Number of active clients",
      messagesDesc: "Messages exchanged with clients",

      // Trends
      increase: "increase",
      decrease: "decrease",
      unchanged: "unchanged",

      // Date Range Selector
      lastWeek: "Last Week",
      lastWeekDesc: "Last 7 days",
      last30Days: "Last 30 Days",
      last30DaysDesc: "Last 30 days",
      last3Months: "Last 3 Months",
      last3MonthsDesc: "Last 90 days",
      last6Months: "Last 6 Months",
      last6MonthsDesc: "Last 180 days",
      lastYear: "Last Year",
      lastYearDesc: "Last 365 days",

      // Historical Chart
      historicalTrends: "Historical Trends - Orders, Revenue and LLM Costs",
      historicalTrendsDesc:
        "Performance evolution in the selected period including AI costs monitoring",
      ordersLabel: "Orders",
      totalOrdersLabel: "Total Orders",
      activeClients: "Active Clients",
      totalRevenue: "Total Revenue",

      // Common
      loading: "Loading...",
      error: "Error",
      success: "Success",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      confirm: "Confirm",
      back: "Back",

      // Dashboard
      dashboard: "Dashboard",
      overview: "Overview",
      metrics: "Metrics",
      reports: "Reports",
    },
    ES: {
      // Analytics Page
      analyticsTitle: "Panel de Análisis",
      analyticsSubtitle:
        "Monitorea el rendimiento y las métricas de crecimiento de tu negocio",
      noWorkspace: "Ningún espacio de trabajo seleccionado",
      retry: "Reintentar",
      loadingError: "No se pueden cargar los datos de análisis",
      dataError: "Error al cargar los datos de análisis",
      topProducts: "Productos Top",
      topCustomers: "Clientes Top",
      topSellers: "Vendedores Top",
      noProductData: "No hay datos de ventas de productos disponibles",
      noCustomerData: "No hay datos de clientes disponibles",
      noSellerData: "No hay datos de vendedores disponibles",
      noAnalyticsData: "No hay datos de análisis disponibles",
      stock: "Stock",
      sold: "vendidos",
      orders: "pedidos",
      average: "Promedio",
      format: "Formato",

      // Metrics Overview
      mainMetrics: "Métricas Principales",
      totalOrders: "Pedidos Totales",
      clients: "Clientes",
      messages: "Mensajes",
      llmCost: "Costo LLM",
      totalOrdersDesc: "Número total de pedidos recibidos",
      activeClientsDesc: "Número de clientes activos",
      messagesDesc: "Mensajes intercambiados con clientes",

      // Trends
      increase: "aumento",
      decrease: "disminución",
      unchanged: "sin cambios",

      // Date Range Selector
      lastWeek: "Última Semana",
      lastWeekDesc: "Últimos 7 días",
      last30Days: "Últimos 30 Días",
      last30DaysDesc: "Últimos 30 días",
      last3Months: "Últimos 3 Meses",
      last3MonthsDesc: "Últimos 90 días",
      last6Months: "Últimos 6 Meses",
      last6MonthsDesc: "Últimos 180 días",
      lastYear: "Último Año",
      lastYearDesc: "Últimos 365 días",

      // Historical Chart
      historicalTrends:
        "Tendencias Históricas - Pedidos, Ingresos y Costos LLM",
      historicalTrendsDesc:
        "Evolución del rendimiento en el período seleccionado incluyendo monitoreo de costos de IA",
      ordersLabel: "Pedidos",
      totalOrdersLabel: "Pedidos Totales",
      activeClients: "Clientes Activos",
      totalRevenue: "Ingresos Totales",

      // Common
      loading: "Cargando...",
      error: "Error",
      success: "Éxito",
      cancel: "Cancelar",
      save: "Guardar",
      delete: "Eliminar",
      edit: "Editar",
      confirm: "Confirmar",
      back: "Atrás",

      // Dashboard
      dashboard: "Panel",
      overview: "Resumen",
      metrics: "Métricas",
      reports: "Reportes",
    },
    PT: {
      // Analytics Page
      analyticsTitle: "Painel de Análise",
      analyticsSubtitle:
        "Monitore o desempenho e as métricas de crescimento do seu negócio",
      noWorkspace: "Nenhum espaço de trabalho selecionado",
      retry: "Tentar novamente",
      loadingError: "Não é possível carregar dados de análise",
      dataError: "Erro ao carregar dados de análise",
      topProducts: "Produtos Top",
      topCustomers: "Clientes Top",
      topSellers: "Vendedores Top",
      noProductData: "Nenhum dado de vendas de produtos disponível",
      noCustomerData: "Nenhum dado de cliente disponível",
      noSellerData: "Nenhum dado de vendedor disponível",
      noAnalyticsData: "Nenhum dado de análise disponível",
      stock: "Estoque",
      sold: "vendidos",
      orders: "pedidos",
      average: "Média",
      format: "Formato",

      // Metrics Overview
      mainMetrics: "Métricas Principais",
      totalOrders: "Pedidos Totais",
      clients: "Clientes",
      messages: "Mensagens",
      llmCost: "Custo LLM",
      totalOrdersDesc: "Número total de pedidos recebidos",
      activeClientsDesc: "Número de clientes ativos",
      messagesDesc: "Mensagens trocadas com clientes",

      // Trends
      increase: "aumento",
      decrease: "diminuição",
      unchanged: "inalterado",

      // Date Range Selector
      lastWeek: "Última Semana",
      lastWeekDesc: "Últimos 7 dias",
      last30Days: "Últimos 30 Dias",
      last30DaysDesc: "Últimos 30 dias",
      last3Months: "Últimos 3 Meses",
      last3MonthsDesc: "Últimos 90 dias",
      last6Months: "Últimos 6 Meses",
      last6MonthsDesc: "Últimos 180 dias",
      lastYear: "Último Ano",
      lastYearDesc: "Últimos 365 dias",

      // Historical Chart
      historicalTrends: "Tendências Históricas - Pedidos, Receita e Custos LLM",
      historicalTrendsDesc:
        "Evolução do desempenho no período selecionado incluindo monitoramento de custos de IA",
      ordersLabel: "Pedidos",
      totalOrdersLabel: "Pedidos Totais",
      activeClients: "Clientes Ativos",
      totalRevenue: "Receita Total",

      // Common
      loading: "Carregando...",
      error: "Erro",
      success: "Sucesso",
      cancel: "Cancelar",
      save: "Salvar",
      delete: "Excluir",
      edit: "Editar",
      confirm: "Confirmar",
      back: "Voltar",

      // Dashboard
      dashboard: "Painel",
      overview: "Visão Geral",
      metrics: "Métricas",
      reports: "Relatórios",
    },
  }

export function getAdminPageTexts(): AdminPageTexts {
  const language =
    (navigator.language.slice(0, 2).toUpperCase() as SupportedLanguage) || "EN"
  return adminPageTranslations[language] || adminPageTranslations.EN
}
