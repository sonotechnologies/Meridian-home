import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const ink = "#10221C";
const muted = "#5A6661";
const green = "#1F5C4A";
const line = "#DDD8CC";

function Layout({ preview, children, footer }: { preview: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: "#F6F3EC", fontFamily: "Inter, Helvetica, Arial, sans-serif", color: ink, margin: 0, padding: "24px 0" }}>
        <Container style={{ background: "#FFFFFF", border: `1px solid ${line}`, borderRadius: 10, padding: 28, maxWidth: 560 }}>
          <Text style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>meridian</Text>
          {children}
          <Hr style={{ borderColor: line, margin: "24px 0 12px" }} />
          <Text style={{ fontSize: 12, color: muted, margin: 0 }}>{footer ?? "Meridian · Homes in Lagos on a live map"}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const p = { fontSize: 15, lineHeight: "22px", margin: "0 0 12px" };
const btn = { background: green, color: "#fff", borderRadius: 6, padding: "12px 18px", fontSize: 15, fontWeight: 600, textDecoration: "none" };

export function CallbackEmail(props: { agentName: string; buyerName: string; phone: string; time: string; message?: string; listingTitle: string; listingUrl: string; dashboardUrl: string }) {
  return (
    <Layout preview={`${props.buyerName} wants a call-back about ${props.listingTitle}`}>
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        New call-back request
      </Heading>
      <Text style={p}>
        {props.buyerName} wants a call about <Link href={props.listingUrl}>{props.listingTitle}</Link>.
      </Text>
      <Section style={{ background: "#F6F3EC", borderRadius: 6, padding: "12px 16px", margin: "0 0 16px" }}>
        <Text style={{ ...p, margin: 0 }}>Phone: <strong style={{ fontFamily: "monospace" }}>{props.phone}</strong></Text>
        <Text style={{ ...p, margin: 0 }}>Best time: {props.time}</Text>
        {props.message ? <Text style={{ ...p, margin: "8px 0 0" }}>“{props.message}”</Text> : null}
      </Section>
      <Button href={props.dashboardUrl} style={btn}>
        Open your leads
      </Button>
    </Layout>
  );
}

export function AlertEmail(props: { searchName: string; listings: { title: string; area: string; price: string; url: string }[]; searchUrl: string; unsubscribeUrl: string }) {
  const n = props.listings.length;
  return (
    <Layout
      preview={`${n} new ${n === 1 ? "home matches" : "homes match"} “${props.searchName}”`}
      footer={
        <>
          You get this because you saved the search “{props.searchName}”. <Link href={props.unsubscribeUrl}>Stop these emails</Link>.
        </>
      }
    >
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        {n} new {n === 1 ? "home" : "homes"} for “{props.searchName}”
      </Heading>
      {props.listings.map((l) => (
        <Section key={l.url} style={{ borderBottom: `1px solid ${line}`, padding: "10px 0" }}>
          <Link href={l.url} style={{ color: ink, fontWeight: 600, fontSize: 15 }}>
            {l.title}
          </Link>
          <Text style={{ fontSize: 14, color: muted, margin: "2px 0 0" }}>
            {l.area} · <span style={{ fontFamily: "monospace", color: ink }}>{l.price}</span>
          </Text>
        </Section>
      ))}
      <Section style={{ marginTop: 20 }}>
        <Button href={props.searchUrl} style={btn}>
          See them on the map
        </Button>
      </Section>
    </Layout>
  );
}

export function ExpiryReminderEmail(props: { agentName: string; listingTitle: string; expiresOn: string; renewUrl: string }) {
  return (
    <Layout preview={`${props.listingTitle} expires on ${props.expiresOn}`}>
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        Is this home still available?
      </Heading>
      <Text style={p}>
        Hello {props.agentName.split(" ")[0]}, your listing “{props.listingTitle}” expires on {props.expiresOn}. If it is still available, renew it for another 30 days with one click.
      </Text>
      <Button href={props.renewUrl} style={btn}>
        Still available
      </Button>
      <Text style={{ ...p, color: muted, marginTop: 16 }}>If it has been let or sold, do nothing and it will come down on its own.</Text>
    </Layout>
  );
}

export function AgentDecisionEmail(props: { name: string; approved: boolean; reason?: string; dashboardUrl: string }) {
  return (
    <Layout preview={props.approved ? "You're verified on Meridian" : "About your Meridian agent application"}>
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        {props.approved ? "You’re verified" : "We couldn’t verify your application"}
      </Heading>
      {props.approved ? (
        <>
          <Text style={p}>Hello {props.name.split(" ")[0]}, your agent account is approved. Your profile and listings now carry the verified badge.</Text>
          <Button href={props.dashboardUrl} style={btn}>
            Post your first listing
          </Button>
        </>
      ) : (
        <>
          <Text style={p}>Hello {props.name.split(" ")[0]}, we couldn’t approve your agent application for this reason:</Text>
          <Text style={{ ...p, background: "#F6F3EC", padding: "12px 16px", borderRadius: 6 }}>{props.reason}</Text>
          <Text style={p}>You can fix this and apply again from the For agents page.</Text>
        </>
      )}
    </Layout>
  );
}

export function ListingDecisionEmail(props: { name: string; listingTitle: string; approved: boolean; reason?: string; url: string }) {
  return (
    <Layout preview={props.approved ? `${props.listingTitle} is live` : `${props.listingTitle} needs changes`}>
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        {props.approved ? "Your listing is live" : "Your listing needs changes"}
      </Heading>
      <Text style={p}>
        “{props.listingTitle}” {props.approved ? "is now on the map." : "was not approved:"}
      </Text>
      {!props.approved ? <Text style={{ ...p, background: "#F6F3EC", padding: "12px 16px", borderRadius: 6 }}>{props.reason}</Text> : null}
      <Button href={props.url} style={btn}>
        {props.approved ? "View listing" : "Edit listing"}
      </Button>
    </Layout>
  );
}
