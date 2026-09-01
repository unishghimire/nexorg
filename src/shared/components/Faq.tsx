import React from 'react';
import { Helmet } from 'react-helmet-async';

// ponytail: Reusable FAQ component rendering details/summary native accordions and injecting FAQPage JSON-LD
export interface FaqItem {
    question: string;
    answer: string;
}

export interface FaqProps {
    items: FaqItem[];
    title?: string;
}

export const Faq: React.FC<FaqProps> = ({ items, title = 'Frequently Asked Questions' }) => {
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };

    return (
        <section className="my-12 px-2" aria-labelledby="faq-section-title">
            <Helmet>
                <script type="application/ld+json">
                    {JSON.stringify(faqSchema)}
                </script>
            </Helmet>
            <div className="max-w-4xl mx-auto">
                <h2 id="faq-section-title" className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight mb-8">
                    {title}
                </h2>
                <div className="space-y-4">
                    {items.map((item, index) => (
                        <details
                            key={index}
                            className="group bg-surface border border-gray-800 rounded-2xl p-5 hover:border-brand-500/30 transition-colors cursor-pointer"
                        >
                            <summary className="font-bold text-white text-base md:text-lg list-none flex justify-between items-center gap-4 select-none">
                                <span>{item.question}</span>
                                <span aria-hidden="true" className="text-brand-500 font-bold text-xl group-open:rotate-45 transition-transform duration-200">
                                    +
                                </span>
                            </summary>
                            <p className="mt-4 text-gray-400 text-sm md:text-base leading-relaxed border-t border-gray-800/50 pt-3">
                                {item.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Faq;
