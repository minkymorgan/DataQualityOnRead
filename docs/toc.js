// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="title.html">Title</a></li><li class="chapter-item expanded affix "><a href="copyright.html">Copyright</a></li><li class="chapter-item expanded affix "><a href="foreword.html">Foreword</a></li><li class="chapter-item expanded affix "><a href="introduction.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="part-title">Part I — The Problem</li><li class="chapter-item expanded "><a href="01-why-data-quality-still-breaks-things.html"><strong aria-hidden="true">1.</strong> Why Data Quality Still Breaks Things</a></li><li class="chapter-item expanded "><a href="02-the-limits-of-traditional-approaches.html"><strong aria-hidden="true">2.</strong> The Limits of Traditional Approaches</a></li><li class="chapter-item expanded affix "><li class="part-title">Part II — Data Quality on Read</li><li class="chapter-item expanded "><a href="03-schema-on-read-quality-on-read.html"><strong aria-hidden="true">3.</strong> Schema on Read, Quality on Read</a></li><li class="chapter-item expanded "><a href="04-mask-based-profiling.html"><strong aria-hidden="true">4.</strong> Mask-Based Profiling</a></li><li class="chapter-item expanded "><a href="05-grain-scripts-and-character-classes.html"><strong aria-hidden="true">5.</strong> Grain, Scripts, and Character Classes</a></li><li class="chapter-item expanded "><a href="06-population-analysis.html"><strong aria-hidden="true">6.</strong> Population Analysis</a></li><li class="chapter-item expanded "><a href="07-masks-as-error-codes.html"><strong aria-hidden="true">7.</strong> Masks as Error Codes</a></li><li class="chapter-item expanded "><a href="08-treatment-functions.html"><strong aria-hidden="true">8.</strong> Treatment Functions and the Quality Loop</a></li><li class="chapter-item expanded affix "><li class="part-title">Part III — The Architecture</li><li class="chapter-item expanded "><a href="09-flat-enhanced-format.html"><strong aria-hidden="true">9.</strong> The Flat Enhanced Format: A Feature Store for Data Quality</a></li><li class="chapter-item expanded "><a href="10-the-tools.html"><strong aria-hidden="true">10.</strong> The Tools: DataRadar and bytefreq</a></li><li class="chapter-item expanded "><a href="11-quality-monitoring.html"><strong aria-hidden="true">11.</strong> Quality Monitoring: Profiling Reports as Fact Tables</a></li><li class="chapter-item expanded "><a href="11-using-dataradar.html"><strong aria-hidden="true">12.</strong> Using DataRadar: A Walkthrough</a></li><li class="chapter-item expanded "><a href="13-using-bytefreq.html"><strong aria-hidden="true">13.</strong> Using bytefreq: Installation, Build, and CLI Reference</a></li><li class="chapter-item expanded "><a href="12-assertion-rules-engine.html"><strong aria-hidden="true">14.</strong> The Assertion Rules Engine: Inside bytefreq</a></li><li class="chapter-item expanded affix "><a href="conclusion.html">Conclusion</a></li><li class="chapter-item expanded affix "><a href="glossary.html">Glossary</a></li><li class="chapter-item expanded affix "><a href="getting-started.html">Getting Started</a></li><li class="chapter-item expanded affix "><a href="worked-example-companies-house.html">Worked Example: Profiling UK Companies House Data</a></li><li class="chapter-item expanded affix "><a href="worked-example-jma-earthquake.html">Worked Example: Profiling JMA Earthquake Data</a></li><li class="chapter-item expanded affix "><a href="worked-example-hatvp-lobbyists.html">Worked Example: Profiling the French Lobbyist Registry</a></li><li class="chapter-item expanded affix "><a href="worked-example-pubmed-xml.html">Worked Example: Profiling PubMed XML — International Biomedical Literature</a></li><li class="chapter-item expanded affix "><a href="about.html">About the Author</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
