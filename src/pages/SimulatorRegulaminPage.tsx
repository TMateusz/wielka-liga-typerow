import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { SimulatorTermsContent } from "../components/simulator/SimulatorTermsContent";

export default function SimulatorRegulaminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="wc-page-title flex items-center gap-2">
            <FileText className="h-8 w-8 text-[var(--wc-gold)]" />
            Regulamin gry towarzyskiej
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Pełna treść zasad modułu aktywności i punktów towarzyskich
          </p>
        </div>
        <Link to="/symulator" className="btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4" />
          Wróć do gry towarzyskiej
        </Link>
      </div>

      <div className="card-pitch p-5 sm:p-6">
        <SimulatorTermsContent />
      </div>
    </div>
  );
}
