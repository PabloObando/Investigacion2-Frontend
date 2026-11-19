import { expect, test } from '@playwright/test'

test('muestra el explorador y sus controles de búsqueda', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', { name: 'Explorador de delitos', exact: true }),
  ).toBeVisible()
  const search = page.getByRole('region', { name: 'Buscar registros', exact: true })
  await expect(search).toBeVisible()
  await expect(search.getByRole('textbox', { name: 'Palabra clave', exact: true })).toBeVisible()
  for (const name of ['Provincia', 'Delito', 'Año']) {
    await expect(search.getByRole('combobox', { name, exact: true })).toBeVisible()
  }
  await expect(search.getByRole('button', { name: 'Buscar', exact: true })).toBeVisible()
})

test('consulta la API de OIJ en Render y muestra el resumen', async ({ page }) => {
  const apiBaseURL = process.env.PLAYWRIGHT_API_BASE_URL?.trim().replace(/\/+$/, '')
  if (!apiBaseURL)
    throw new Error('Configura PLAYWRIGHT_API_BASE_URL con la URL pública de Render.')

  const expectedOrigin = new URL(apiBaseURL).origin
  const keyword = 'hurto'
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const frontendOrigin = new URL(page.url()).origin
  const search = page.getByRole('region', { name: 'Buscar registros', exact: true })
  await search.getByRole('textbox', { name: 'Palabra clave', exact: true }).fill(keyword)

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) => {
        const url = new URL(candidate.url())
        return (
          candidate.request().method() === 'GET' &&
          url.pathname === '/api/oij/registros' &&
          url.searchParams.get('q') === keyword
        )
      },
      { timeout: 75_000 },
    ),
    search.getByRole('button', { name: 'Buscar', exact: true }).click(),
  ])

  const requestOrigin = new URL(response.request().url()).origin
  expect(requestOrigin, 'La consulta debe salir del dominio del frontend').not.toBe(frontendOrigin)
  expect(requestOrigin).toBe(expectedOrigin)
  expect(response.url().startsWith(`${apiBaseURL}/`), `URL recibida: ${response.url()}`).toBe(true)
  expect(response.ok(), `La API OIJ devolvió HTTP ${response.status()}`).toBe(true)

  const result = (await response.json()) as {
    firstDate: string
    lastDate: string
    records: unknown[]
  }
  expect(result.firstDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(result.lastDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(Array.isArray(result.records)).toBe(true)

  const summary = page.getByRole('region', { name: 'Resumen de la consulta', exact: true })
  const firstDate = result.firstDate.split('-').reverse().join('/')
  const lastDate = result.lastDate.split('-').reverse().join('/')
  await expect(summary.getByRole('status')).toHaveText(
    `Cobertura de la fuente: ${firstDate} – ${lastDate}`,
  )
  await expect(summary.getByText('Registros encontrados', { exact: true })).toBeVisible()
  await expect(summary.getByRole('alert')).toHaveCount(0)
})
