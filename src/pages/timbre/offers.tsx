import { Link } from "react-router-dom";
import { BellRing, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Commercial entry within the existing marketplace. No acquisition button
 * here grants service access; the backend verifies a purchased entitlement. */
export default function TimbreMarketplaceOffer() {
  return (
    <section className="vm-featured" aria-label="Timbre VISO">
      <div className="vm-featured-copy">
        <span className="vm-featured-label">
          <BellRing aria-hidden="true" /> SERVICIO VISO
        </span>
        <h2>Tu puerta, conectada con vos.</h2>
        <p>
          Recibí visitas por QR desde VISO. Conocé los planes digitales, las
          placas personalizadas y las licencias incluidas con equipos elegibles.
        </p>
        <Button asChild>
          <Link to="/timbre">
            Conocer Timbre <ArrowUpRight />
          </Link>
        </Button>
        <p>Requiere una licencia paga o incluida expresamente con tu compra.</p>
      </div>
      <div className="flex items-center justify-center p-10" aria-hidden="true">
        <BellRing className="size-24 text-[#e84300]" />
      </div>
    </section>
  );
}
