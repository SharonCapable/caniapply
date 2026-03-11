import ReactMarkdown from "react-markdown";

export default function Markdown({ text }) {
    const styles = {
        fontSize: "0.88rem",
        lineHeight: "1.7",
        color: "var(--text-bright)",
    };

    return (
        <div style={styles} className="markdown-content">
            <ReactMarkdown
                components={{
                    h1: ({ node, ...props }) => <h1 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "14px 0 8px", color: "var(--gold)" }} {...props} />,
                    h2: ({ node, ...props }) => <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "12px 0 6px", color: "var(--gold)" }} {...props} />,
                    h3: ({ node, ...props }) => <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "10px 0 4px", color: "var(--gold)" }} {...props} />,
                    p: ({ node, ...props }) => <p style={{ margin: "0 0 10px" }} {...props} />,
                    ul: ({ node, ...props }) => <ul style={{ margin: "0 0 10px", paddingLeft: "18px" }} {...props} />,
                    ol: ({ node, ...props }) => <ol style={{ margin: "0 0 10px", paddingLeft: "18px" }} {...props} />,
                    li: ({ node, ...props }) => <li style={{ margin: "0 0 5px" }} {...props} />,
                    code: ({ node, inline, ...props }) =>
                        inline ?
                            <code style={{ background: "var(--bg2)", padding: "2px 5px", borderRadius: "4px", fontSize: "0.85rem", color: "var(--gold)" }} {...props} /> :
                            <code style={{ display: "block", background: "var(--bg2)", padding: "12px", borderRadius: "8px", fontSize: "0.82rem", margin: "10px 0", overflowX: "auto", border: "1px solid var(--border)" }} {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote style={{ borderLeft: "3px solid var(--gold-dim)", paddingLeft: "14px", margin: "12px 0", color: "var(--text-dim)", fontStyle: "italic" }} {...props} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
