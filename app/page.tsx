import { Hero } from "@/components/landing/hero";
import { About } from "@/components/landing/about";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <Hero />
        <About />
        <Faq />
      </main>
      <Footer />
      <Reveal />
    </div>
  );
}
