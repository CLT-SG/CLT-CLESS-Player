/**
 * XML fixtures reproducing what `core/views/main.py:buildXML` and
 * `core/views/layoutloop.py:loopxml` emit on CLESS-Server, including the
 * quirks the adapter has to tolerate: the `bgscretch` spelling, `Y`/`N`
 * booleans, the `1920_1080_landscape` resolution format, and the `records`
 * block living outside `display`.
 */

export const SINGLE_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<Configuration update="20260927101500" serverRefresh="90" sqlQueryRefresh="30" layout="Terminal Main" ds="Gate A12" mediapath="/media/uploads" id="42" schedule_id="7">
  <display data="record" bgcolor="#101418" bgimage="lobby-bg.jpg" resolution="1920_1080_landscape" autoscale="Y" bgscretch="Y">
    <slots>
      <table update="20260927101500" id="9" align="c" valign="middle" cellspacing="0" font="Inter" enabled="Y" fontsize="28" fontcolor="#ffffff" maxrows_limit="12" maxrows_enabled="Y" left="0" top="300" height="700" width="1920" bgcolor="#000000" transparentbg="N" wrap="N" horizontalborder="Y" verticalborder="N" title="Departures" bodyrowHeight="56" flipmode="0" hidepagination="N" pageflip="8" transition="fade" fixedheight="Y" flipmode_speed="500" flipmode_delay="0">
        <heading font="Inter" fontsize="24" fontcolor="#c8d2dc" bgcolor="#1d242c" hideheader="N"/>
        <column>
          <item width="200" align="l" tlradius="0" trradius="0" blradius="0" brradius="0" bgcolor_enabled="N" bgcolor="" text_transition_enabled="N" text_transition="none" text_transition_switching_time="0" text_transition_speed="0" text_transition_delay="0" image_enabled="N" image_transition="none" image_switching_time="0" image_transition_speed="0" image_transition_delay="0" fill_to_column="N">Flight</item>
          <item width="400" align="l" tlradius="0" trradius="0" blradius="0" brradius="0" bgcolor_enabled="N" bgcolor="" text_transition_enabled="N" text_transition="none" text_transition_switching_time="0" text_transition_speed="0" text_transition_delay="0" image_enabled="N" image_transition="none" image_switching_time="0" image_transition_speed="0" image_transition_delay="0" fill_to_column="N">Destination</item>
          <item width="150" align="c" tlradius="0" trradius="0" blradius="0" brradius="0" bgcolor_enabled="Y" bgcolor="#203040" text_transition_enabled="N" text_transition="none" text_transition_switching_time="0" text_transition_speed="0" text_transition_delay="0" image_enabled="Y" image_transition="fade" image_switching_time="4" image_transition_speed="400" image_transition_delay="0" fill_to_column="N">Airline</item>
        </column>
        <row margin="2" oddcolor="#151b21" evencolor="#1b2229"/>
      </table>
      <html id="3" top="0" left="1400" width="520" height="300" enabled="Y">
        <item duration="0">https://cms.example.com/demo/widget/weather</item>
      </html>
      <widget id="11" name="queue-counter" top="0" left="0" width="700" height="200" layer="4" enabled="Y" transparent="Y" bgcolor="#000000" interactive="N" scheduled="Y" active="Y" start="2026-01-01" end="2026-12-31" days="1,2,3,4,5" timestart="06:00" timeend="23:30">
        <item id="55" widget="queue" name="Queue Counter" template="default" renderer="webview" category="ops" duration="30" order="0" enabled="Y" refresh="15" transport="sse" cache="Y" offline="Y" data="{}" stream="">https://cms.example.com/demo/widget/55/preview</item>
      </widget>
      <media id="1" top="0" left="0" width="1920" height="300" enabled="Y" name="hero" layer="0">
        <item duration="12" layer="0" id="101">7/promo-loop.mp4</item>
        <item duration="8" layer="0" id="102">7/gate-signage.jpg</item>
        <item duration="0" layer="0" id="103">{rtsp:cam-01.local/stream1}</item>
      </media>
      <text id="2" align="c" valign="middle" top="220" left="0" width="1200" height="80" enabled="Y" font="Inter" fontsize="42" fontcolor="#f4f7fa" fontstyle="bold,italic" bgcolor="#000000" transparent="Y" name="headline">
        <item id="201" duration="10">Welcome to Terminal 3</item>
        <item id="202" duration="10">Please keep your boarding pass ready</item>
      </text>
      <ticker id="4" top="1020" left="0" width="1920" height="60" enabled="Y" font="Inter" fontsize="30" fontcolor="#ffffff" fontstyle="" bgcolor="#0b0f13" direction="righttoleft" speed="4" antialias="Y" transparent="N" name="news">
        <item id="301" duration="0">Security reminder: liquids must be under 100ml</item>
      </ticker>
      <scroller id="5" top="300" left="1400" width="520" height="400" enabled="N" font="Inter" fontsize="24" fontcolor="#ffffff" fontstyle="" bgcolor="#000000" direction="scrollup" speed="2" name="notices">
        <item id="401" duration="0">Disabled slot should not render</item>
      </scroller>
      <fader id="6" top="700" left="1400" width="520" height="200" enabled="Y" align="c" font="Inter" fontsize="26" fontcolor="#e8eef4" fontstyle="" bgcolor="#000000" speed="3" transparent="N" name="tips">
        <item id="501" duration="0">Gate closes 20 minutes before departure</item>
        <item id="502" duration="0">Free wifi: T3-GUEST</item>
      </fader>
      <datetime id="7" align="r" valign="top" top="20" left="1600" width="300" height="70" enabled="Y" font="Inter" fontsize="40" fontcolor="#ffffff" fontstyle="" bgcolor="#000000" transparent="Y" format="dd/mmm/yyyy HH:nn AM/PM" name="clock"/>
      <holovideo id="99" top="0" left="0" width="100" height="100" enabled="Y" name="future-type" depth="3" codec="av1">
        <item id="901" duration="5">future/asset.hvid</item>
      </holovideo>
    </slots>
  </display>
  <records>
    <table id="9">
      <row col01="SQ318" col02="London Heathrow" col03="image:fade:4:sq.png,sq-alt.png" style="color:#ff9900"/>
      <row col01="EK355" col02="Dubai" col03="image:fade:4:ek.png"/>
      <row col01="QF002" col02="Sydney" col03="transition:slide:3:On Time,Boarding"/>
    </table>
  </records>
</Configuration>`

export const LOOP_XML = `<?xml version="1.0" encoding="utf-8"?>
<Configure update="20260927090000" mediapath="/media/uploads" sync_master_ip="10.4.1.20">
  <loop name="Terminal Rotation" id="3" transition_style="fade" transition_speed="1200" transition_delay="150">
    <layout url="https://cms.example.com/demo/layout/42/ds.xml" duration="25" dsxml="1" name="Terminal Main"/>
    <layout url="https://cms.example.com/demo/layout/43/ds.xml" duration="15" dsxml="1" name="Retail Promo"/>
  </loop>
</Configure>`

export const LOOP_MEMBER_XML = `<?xml version="1.0" encoding="utf-8"?>
<Configuration update="20260927093000" serverRefresh="120" sqlQueryRefresh="30" layout="Retail Promo" mediapath="/media/uploads" id="43" schedule_id="0">
  <display data="record" bgcolor="#000000" bgimage="none" resolution="1920x1080" autoscale="N" bgscretch="N">
    <slots>
      <media id="20" top="0" left="0" width="1920" height="1080" enabled="Y" name="promo" layer="0">
        <item duration="10" layer="0" id="601">9/retail-a.jpg</item>
      </media>
    </slots>
  </display>
  <records/>
</Configuration>`

/**
 * Minimal `xml-js`-compatible parser used by the tests, matching the
 * `{ compact: false }` tree shape that both `xml-js` in Electron and the
 * browser host's `DOMParser` bridge produce.
 */
export function parseXmlForTests(xml: string): unknown {
  const parsed = new DOMParser().parseFromString(xml, 'text/xml')

  function convert(element: Element): Record<string, unknown> {
    const attributes: Record<string, string> = {}
    for (const attribute of Array.from(element.attributes)) {
      attributes[attribute.name] = attribute.value
    }

    const elements: Array<Record<string, unknown>> = []
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1) {
        elements.push(convert(child as Element))
      } else if (child.nodeType === 3 && (child.textContent ?? '').trim()) {
        elements.push({ type: 'text', text: child.textContent })
      }
    }
    return { type: 'element', name: element.tagName, attributes, elements }
  }

  const root = parsed.documentElement
  return { elements: root ? [convert(root)] : [] }
}
