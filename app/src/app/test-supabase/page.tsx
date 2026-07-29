import { createClient } from "@/lib/supabase/server";

// Página temporal solo para verificar que la conexión a Supabase funciona
// y que la migración 0001_init.sql se aplicó correctamente.
// Bórrala cuando tengas el dashboard real (Fase 1).
export default async function TestSupabasePage() {
  const supabase = await createClient();

  const { data: agencies, error } = await supabase
    .from("agencies")
    .select("id, name")
    .limit(5);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Test de conexión a Supabase</h1>

      {error ? (
        <>
          <p style={{ color: "red" }}>
            Error al conectar o consultar la tabla `agencies`:
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
          <p>
            Revisa: 1) que copiaste las claves en `.env.local`, 2) que
            ejecutaste `supabase/migrations/0001_init.sql` en el SQL editor
            de Supabase, 3) que reiniciaste `npm run dev` tras crear
            `.env.local`.
          </p>
        </>
      ) : (
        <>
          <p style={{ color: "green" }}>
            Conexión correcta. Tabla `agencies` accesible ({agencies?.length ?? 0}{" "}
            filas devueltas, es normal que esté vacía todavía).
          </p>
          <pre>{JSON.stringify(agencies, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
