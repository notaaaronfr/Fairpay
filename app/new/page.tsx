import Link from 'next/link';
import { NewContractForm } from '../../components/NewContractForm.tsx';
import { AgentBrief } from '../../components/AgentBrief.tsx';
import { BlurText, Rise } from '../../components/Motion.tsx';
import { Back } from '../../components/Icons.tsx';
import { agentReady } from '../../lib/agent.ts';

export const dynamic = 'force-dynamic';

export default function New() {
  const a = agentReady();
  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome"><span className="chip">Agree → Fund → Prove → Pay</span></div>
          <div className="big-money" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}><BlurText text="New escrow" /></div>
        </div>
        <div className="actions"><Link href="/" className="act"><Back />Back</Link></div>
      </section>
      <Rise><AgentBrief ready={a.ok} why={a.why} /></Rise>
      <div className="or"><span>or build it</span></div>
      <Rise i={1}><NewContractForm /></Rise>
    </>
  );
}
