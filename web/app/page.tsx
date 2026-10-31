import Link from "next/link";
import { LiveRowCount } from "./components/live-row-count";
import { TopNav } from "./components/top-nav";

const dashboard = {
	href: "/dashboard",
	label: "Dashboard",
	detail: "AG Studio reports over all of the data",
};

// One page per PayPal endpoint the demo calls, each in app/(endpoints).
const endpoints = [
	{
		href: "/products",
		label: "Catalog products",
		detail: "GET /v1/catalogs/products",
	},
	{ href: "/plans", label: "Billing plans", detail: "GET /v1/billing/plans" },
	{
		href: "/invoices",
		label: "Invoices",
		detail: "GET /v2/invoicing/invoices",
	},
	{
		href: "/transactions",
		label: "Transactions",
		detail: "GET /v1/reporting/transactions",
	},
	{
		href: "/balances",
		label: "Balances",
		detail: "GET /v1/reporting/balances",
	},
];

// The 5-second homepage (stage 103 ★): ONE scenario — see the product, open the
// Ledger (the working seller tool). Everything else lives below the fold.
export default function Home() {
	return (
		<main className="min-h-dvh bg-pp-canvas px-8 py-6 font-paypal text-pp-ink">
			<div className="mx-auto w-full max-w-[1400px]">
				{/* app chrome (stage 106: same nav on every screen) */}
				<TopNav />

				{/* trust line */}
				<p className="text-xs font-semibold uppercase tracking-wider text-pp-muted">
					PayPal sandbox · AG Grid + AG Studio · live data
				</p>

				{/* hero */}
				<h1 className="mt-6 text-[40px] font-semibold leading-tight text-pp-navy">
					Cross-Border Reconciliation Agent
				</h1>
				<p className="mt-3 max-w-2xl text-lg text-pp-muted">
					The seller&apos;s AI agent that reconciles every PayPal payment,
					explains every mismatch, and acts — inside hard guardrails.
				</p>

				{/* primary CTA + secondaries */}
				<div className="mt-8 flex flex-wrap items-center gap-4">
					<Link
						href="/reconciliation"
						className="group inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-b from-pp-blue to-pp-blue-dark px-6 text-[15px] font-semibold tracking-wide text-white shadow-lg shadow-pp-blue/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pp-blue/40 active:translate-y-0"
					>
						Open the Ledger
						<span className="transition group-hover:translate-x-0.5">→</span>
					</Link>
					<Link
						href="/negotiation"
						className="text-sm font-semibold text-pp-blue-dark hover:underline"
					>
						Negotiation demo →
					</Link>
					<Link
						href="/dashboard"
						className="text-sm font-semibold text-pp-blue-dark hover:underline"
					>
						AG Studio dashboard →
					</Link>
				</div>

				{/* proof chips — evidence-backed facts, not hype */}
				<ul className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-pp-navy">
					<li>
						<LiveRowCount />
					</li>
					{["AI explains every mismatch", "Audited guardrails"].map((chip) => (
						<li
							key={chip}
							className="rounded-full border border-pp-border bg-white px-3 py-1"
						>
							{chip}
						</li>
					))}
				</ul>

				{/* explore: our screens as cards + the boilerplate REST endpoints compactly */}
				<section className="mt-14">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-pp-muted">
						Explore
					</h2>
					<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
						{[
							{
								href: "/dashboard",
								label: "Dashboard",
								detail: "AG Studio reports",
							},
							{
								href: "/negotiation",
								label: "Negotiation",
								detail: "Two agents haggle",
							},
							{ href: "/agent", label: "Agent", detail: "Audit trail" },
							{
								href: "/settings",
								label: "Settings",
								detail: "Guardrails in view",
							},
						].map((c) => (
							<Link
								key={c.href}
								href={c.href}
								className="group rounded-lg border border-pp-border bg-white p-4 transition hover:-translate-y-0.5 hover:border-pp-blue hover:shadow-md"
							>
								<span className="flex items-center justify-between font-semibold text-pp-navy">
									{c.label}
									<span className="text-pp-blue transition group-hover:translate-x-0.5">
										→
									</span>
								</span>
								<span className="mt-1 block text-xs text-pp-muted">
									{c.detail}
								</span>
							</Link>
						))}
					</div>
					<p className="mt-4 text-sm text-pp-muted">
						PayPal REST endpoints:{" "}
						{endpoints.map((e, i) => (
							<span key={e.href}>
								<Link
									href={e.href}
									className="font-semibold text-pp-blue-dark hover:underline"
								>
									{e.label}
								</Link>
								{i < endpoints.length - 1 ? " · " : ""}
							</span>
						))}
					</p>
				</section>
			</div>
		</main>
	);
}
