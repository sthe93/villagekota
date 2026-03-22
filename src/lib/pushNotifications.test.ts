import { describe, expect, it } from "vitest";
import {
  buildAdminOrderNotification,
  buildDriverDispatchNotification,
  buildOrderNotification,
  buildPaymentNotification,
} from "@/lib/pushNotifications";

describe("buildOrderNotification", () => {
  it("maps order statuses to customer notification content", () => {
    expect(buildOrderNotification({ orderId: "abc123", status: "on_the_way" })).toMatchObject({
      title: "Driver on the way",
      audience: "customer",
      url: "/order-tracking/abc123",
    });
  });

  it("returns null for unknown statuses", () => {
    expect(buildOrderNotification({ orderId: "abc123", status: "mystery" })).toBeNull();
  });
});

describe("buildPaymentNotification", () => {
  it("maps successful payment states", () => {
    expect(buildPaymentNotification({ orderId: "abc123", paymentStatus: "paid" })).toMatchObject({
      title: "Payment confirmed",
      audience: "customer",
    });
  });

  it("maps failed payment states", () => {
    expect(buildPaymentNotification({ orderId: "abc123", paymentStatus: "failed" })).toMatchObject({
      title: "Payment needs attention",
      audience: "customer",
    });
  });
});

describe("role notifications", () => {
  it("builds driver dispatch notifications", () => {
    expect(buildDriverDispatchNotification("order-1")).toMatchObject({
      title: "New delivery available",
      audience: "driver",
      url: "/driver",
    });
  });

  it("builds admin order notifications", () => {
    expect(buildAdminOrderNotification("order-1")).toMatchObject({
      title: "New order received",
      audience: "admin",
      url: "/admin/orders",
    });
  });
});
