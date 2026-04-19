import Link from "next/link"
import AuthLayout from "@/components/AuthLayout"
import { AuthCard } from "../_components/AuthCard"
import { EmailIcon } from "../_components/EmailIcon"

export default function VerifyRequestPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <EmailIcon />

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 400,
            color: "var(--color-text)",
            textAlign: "center",
            marginBottom: "12px",
            letterSpacing: "-0.01em",
          }}
        >
          验证邮件已发送
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "var(--color-text-secondary)",
            textAlign: "center",
            lineHeight: 1.7,
            marginBottom: "24px",
          }}
        >
          我们已向您的邮箱发送了一封验证邮件。
          <br />
          请查收并点击邮件中的链接完成注册。
        </p>

        <div
          style={{
            padding: "14px 16px",
            background: "rgba(217, 119, 6, 0.06)",
            borderRadius: "10px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            没有收到邮件？请检查垃圾邮件文件夹，或确认邮箱地址是否填写正确。
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
