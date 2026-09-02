import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAgencia } from "@/lib/auth";
import { num, type Recurrencia } from "@/lib/facturacion";
import { Catalogo, type Servicio } from "./catalogo";

export default async function ServiciosPage() {
  const perfil = await requireAgencia();
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_user_id", perfil.userId)
    .single();

  const { data } = await supabase
    .from("services")
    .select("id, nombre, descripcion, precio, recurrencia, modulo, activo")
    .eq("agency_id", agency?.id ?? "")
    .order("created_at");

  const servicios: Servicio[] = (data ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: num(s.precio),
    recurrencia: s.recurrencia as Recurrencia,
    modulo: s.modulo,
    activo: s.activo,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/facturacion"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a facturación
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            Servicios y tarifas
          </h1>
          <p className="text-sm text-muted-foreground">
            Lo que vendes y a qué precio. Es tu lista de precios interna: ningún
            cliente la ve.
          </p>
        </div>
      </div>

      <Catalogo servicios={servicios} />
    </div>
  );
}
