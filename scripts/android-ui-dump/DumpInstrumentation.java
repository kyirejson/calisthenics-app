package com.uncover.uidump;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.StringWriter;
import org.xmlpull.v1.XmlSerializer;

/** Read-only UI tree capture. It never starts or restarts the app under test. */
public class DumpInstrumentation extends Instrumentation {
  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
  @Override public void onStart() {
    Bundle result = new Bundle();
    try {
      UiAutomation automation = getUiAutomation();
      AccessibilityServiceInfo info = automation.getServiceInfo();
      info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
      automation.setServiceInfo(info);
      AccessibilityNodeInfo root = null;
      for (int retry = 0; retry < 30 && root == null; retry++) {
        root = automation.getRootInActiveWindow();
        if (root == null) SystemClock.sleep(100);
      }
      if (root == null) throw new IllegalStateException("No active UI root");
      StringWriter text = new StringWriter();
      XmlSerializer xml = Xml.newSerializer(); xml.setOutput(text);
      xml.startDocument("UTF-8", true); xml.startTag(null, "hierarchy");
      append(xml, root); xml.endTag(null, "hierarchy"); xml.endDocument();
      result.putString("xml", text.toString()); finish(Activity.RESULT_OK, result);
    } catch (Exception error) {
      result.putString("error", error.toString()); finish(Activity.RESULT_CANCELED, result);
    }
  }
  private void append(XmlSerializer xml, AccessibilityNodeInfo node) throws Exception {
    Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
    xml.startTag(null, "node");
    xml.attribute(null, "text", string(node.getText()));
    xml.attribute(null, "content-desc", string(node.getContentDescription()));
    xml.attribute(null, "resource-id", string(node.getViewIdResourceName()));
    xml.attribute(null, "bounds", "[" + bounds.left + "," + bounds.top + "][" + bounds.right + "," + bounds.bottom + "]");
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo child = node.getChild(i);
      if (child != null) append(xml, child);
    }
    xml.endTag(null, "node");
  }
  private String string(CharSequence value) { return value == null ? "" : value.toString(); }
}
