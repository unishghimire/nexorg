import Seo from '../../../shared/components/Seo';
import React from 'react';
import { FileText } from 'lucide-react';

const Terms: React.FC = () => {
    return (
        <>
        <Seo
            title="Terms of Service | NexPlay"
            description="Read NexPlay's terms of service for using Nepal's esports tournament platform."
            canonicalPath="/terms"
            noindex
        />
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="bg-card p-5 sm:p-8 rounded-xl border border-gray-800 shadow-2xl">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center">
                    <FileText className="mr-3 text-brand-500 w-8 h-8" /> Terms of Service
                </h1>
                <div className="space-y-6 text-gray-300 text-sm leading-relaxed h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">1. Acceptance of Terms</h3>
                        <p>By registering for or using NexPlay (“we”, “our”, “us”), you agree to be bound by these Terms of Service. If you do not agree, you must not access or use the platform. These terms govern tournaments, scrims, team management, and match participation.</p>
                    </section>
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">2. User Eligibility & Code of Conduct</h3>
                        <p>Users must provide accurate, complete, and current information when creating an account. Any form of cheating, use of unapproved game hacks/modifications, toxic behavior, matches collusion, or identity fraud is strictly prohibited and will result in an immediate permanent ban and forfeiture of wallet funds.</p>
                    </section>
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">3. Wallet, Entries, escrow & Refunds</h3>
                        <p>NexPlay operates a tournament wallet system. Escrowed funds (entry fees) are locked during active tournaments. Refunds are only auto-credited if a tournament is officially cancelled by the tournament organizer or administration. In-game matches, payouts, and balances tracking remain protected under secure cryptographic server-side validation.</p>
                    </section>
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">4. Disclaimers & Limitation of Liability</h3>
                        <p>We are not responsible for game server connectivity issues, hardware crashes, or network disconnects during third-party tournament gameplay. We facilitate esports matchmaking/hosting with fairness but are not liable for direct/indirect losses beyond active escrowed tournament funds.</p>
                    </section>
                    <div className="mt-8 pt-4 border-t border-gray-700">
                        <p className="text-xs text-gray-500">Last Updated: October 2025</p>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default Terms;
