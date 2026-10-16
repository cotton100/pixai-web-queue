// ==UserScript==
// @name         PixAI 웹 대기열 (로컬 후보)
// @namespace    local.pixai-web-queue
// @version      0.10.3-dev.1
// @license      GPL-3.0-only
// @homepageURL  https://github.com/cotton100/pixai-web-queue
// @updateURL    https://raw.githubusercontent.com/cotton100/pixai-web-queue/develop/pixai-web-queue.dev.user.js
// @downloadURL  https://raw.githubusercontent.com/cotton100/pixai-web-queue/develop/pixai-web-queue.dev.user.js
// @description  [개발판] 모델·LoRA 트리거와 캐릭터·여러 청크 프롬프트를 조합해 순차 생성하고 브라우저에 맞는 방식으로 원본을 저장합니다.
// @match        https://pixai.art/*
// @grant        GM_download
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.pixai.art
// @connect      *.pixai.art
// @connect      d2doj8oszwtcqy.cloudfront.net
// @sandbox      DOM
// @run-at       document-start
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const UPDATE_CHANNEL = 'development';
  const UPDATE_BUILD_VERSION = '0.10.3-dev.1';
  const UPDATE_URLS = Object.freeze({stable:'https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js',development:'https://raw.githubusercontent.com/cotton100/pixai-web-queue/develop/pixai-web-queue.dev.user.js'});
  function updateChannelUrl(channel) {
    if (!Object.hasOwn(UPDATE_URLS,channel)) throw new Error('업데이트 채널을 다시 선택해 주세요.');
    return UPDATE_URLS[channel];
  }
  function updateChannelInfo(info) {
    const url=info?.scriptUpdateURL ?? info?.script?.updateURL ?? info?.script?.downloadURL;
    const automatic=Object.keys(UPDATE_URLS).find(channel=>UPDATE_URLS[channel]===url) || null;
    return {installed:UPDATE_CHANNEL,version:UPDATE_BUILD_VERSION,automatic,enabled:typeof info?.scriptWillUpdate==='boolean' ? info.scriptWillUpdate : null};
  }
  // BEGIN GPL LICENSE
/*
PixAI web queue browser port, modified 2026-10-13 by cotton100.
Adapted from PixaiClackHelper (cotton100), based on NAIS3 (sunanakgo).
This program is free software under GPL version 3, WITHOUT ANY WARRANTY.
GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

  For the developers' and authors' protection, the GPL clearly explains
that there is no warranty for this free software.  For both users' and
authors' sake, the GPL requires that modified versions be marked as
changed, so that their problems will not be attributed erroneously to
authors of previous versions.

  Some devices are designed to deny users access to install or run
modified versions of the software inside them, although the manufacturer
can do so.  This is fundamentally incompatible with the aim of
protecting users' freedom to change the software.  The systematic
pattern of such abuse occurs in the area of products for individuals to
use, which is precisely where it is most unacceptable.  Therefore, we
have designed this version of the GPL to prohibit the practice for those
products.  If such problems arise substantially in other domains, we
stand ready to extend this provision to those domains in future versions
of the GPL, as needed to protect the freedom of users.

  Finally, every program is threatened constantly by software patents.
States should not allow patents to restrict development and use of
software on general-purpose computers, but in those that do, we wish to
avoid the special danger that patents applied to a free program could
make it effectively proprietary.  To prevent this, the GPL assures that
patents cannot be used to render the program non-free.

  The precise terms and conditions for copying, distribution and
modification follow.

                       TERMS AND CONDITIONS

  0. Definitions.

  "This License" refers to version 3 of the GNU General Public License.

  "Copyright" also means copyright-like laws that apply to other kinds of
works, such as semiconductor masks.

  "The Program" refers to any copyrightable work licensed under this
License.  Each licensee is addressed as "you".  "Licensees" and
"recipients" may be individuals or organizations.

  To "modify" a work means to copy from or adapt all or part of the work
in a fashion requiring copyright permission, other than the making of an
exact copy.  The resulting work is called a "modified version" of the
earlier work or a work "based on" the earlier work.

  A "covered work" means either the unmodified Program or a work based
on the Program.

  To "propagate" a work means to do anything with it that, without
permission, would make you directly or secondarily liable for
infringement under applicable copyright law, except executing it on a
computer or modifying a private copy.  Propagation includes copying,
distribution (with or without modification), making available to the
public, and in some countries other activities as well.

  To "convey" a work means any kind of propagation that enables other
parties to make or receive copies.  Mere interaction with a user through
a computer network, with no transfer of a copy, is not conveying.

  An interactive user interface displays "Appropriate Legal Notices"
to the extent that it includes a convenient and prominently visible
feature that (1) displays an appropriate copyright notice, and (2)
tells the user that there is no warranty for the work (except to the
extent that warranties are provided), that licensees may convey the
work under this License, and how to view a copy of this License.  If
the interface presents a list of user commands or options, such as a
menu, a prominent item in the list meets this criterion.

  1. Source Code.

  The "source code" for a work means the preferred form of the work
for making modifications to it.  "Object code" means any non-source
form of a work.

  A "Standard Interface" means an interface that either is an official
standard defined by a recognized standards body, or, in the case of
interfaces specified for a particular programming language, one that
is widely used among developers working in that language.

  The "System Libraries" of an executable work include anything, other
than the work as a whole, that (a) is included in the normal form of
packaging a Major Component, but which is not part of that Major
Component, and (b) serves only to enable use of the work with that
Major Component, or to implement a Standard Interface for which an
implementation is available to the public in source code form.  A
"Major Component", in this context, means a major essential component
(kernel, window system, and so on) of the specific operating system
(if any) on which the executable work runs, or a compiler used to
produce the work, or an object code interpreter used to run it.

  The "Corresponding Source" for a work in object code form means all
the source code needed to generate, install, and (for an executable
work) run the object code and to modify the work, including scripts to
control those activities.  However, it does not include the work's
System Libraries, or general-purpose tools or generally available free
programs which are used unmodified in performing those activities but
which are not part of the work.  For example, Corresponding Source
includes interface definition files associated with source files for
the work, and the source code for shared libraries and dynamically
linked subprograms that the work is specifically designed to require,
such as by intimate data communication or control flow between those
subprograms and other parts of the work.

  The Corresponding Source need not include anything that users
can regenerate automatically from other parts of the Corresponding
Source.

  The Corresponding Source for a work in source code form is that
same work.

  2. Basic Permissions.

  All rights granted under this License are granted for the term of
copyright on the Program, and are irrevocable provided the stated
conditions are met.  This License explicitly affirms your unlimited
permission to run the unmodified Program.  The output from running a
covered work is covered by this License only if the output, given its
content, constitutes a covered work.  This License acknowledges your
rights of fair use or other equivalent, as provided by copyright law.

  You may make, run and propagate covered works that you do not
convey, without conditions so long as your license otherwise remains
in force.  You may convey covered works to others for the sole purpose
of having them make modifications exclusively for you, or provide you
with facilities for running those works, provided that you comply with
the terms of this License in conveying all material for which you do
not control copyright.  Those thus making or running the covered works
for you must do so exclusively on your behalf, under your direction
and control, on terms that prohibit them from making any copies of
your copyrighted material outside their relationship with you.

  Conveying under any other circumstances is permitted solely under
the conditions stated below.  Sublicensing is not allowed; section 10
makes it unnecessary.

  3. Protecting Users' Legal Rights From Anti-Circumvention Law.

  No covered work shall be deemed part of an effective technological
measure under any applicable law fulfilling obligations under article
11 of the WIPO copyright treaty adopted on 20 December 1996, or
similar laws prohibiting or restricting circumvention of such
measures.

  When you convey a covered work, you waive any legal power to forbid
circumvention of technological measures to the extent such circumvention
is effected by exercising rights under this License with respect to
the covered work, and you disclaim any intention to limit operation or
modification of the work as a means of enforcing, against the work's
users, your or third parties' legal rights to forbid circumvention of
technological measures.

  4. Conveying Verbatim Copies.

  You may convey verbatim copies of the Program's source code as you
receive it, in any medium, provided that you conspicuously and
appropriately publish on each copy an appropriate copyright notice;
keep intact all notices stating that this License and any
non-permissive terms added in accord with section 7 apply to the code;
keep intact all notices of the absence of any warranty; and give all
recipients a copy of this License along with the Program.

  You may charge any price or no price for each copy that you convey,
and you may offer support or warranty protection for a fee.

  5. Conveying Modified Source Versions.

  You may convey a work based on the Program, or the modifications to
produce it from the Program, in the form of source code under the
terms of section 4, provided that you also meet all of these conditions:

    a) The work must carry prominent notices stating that you modified
    it, and giving a relevant date.

    b) The work must carry prominent notices stating that it is
    released under this License and any conditions added under section
    7.  This requirement modifies the requirement in section 4 to
    "keep intact all notices".

    c) You must license the entire work, as a whole, under this
    License to anyone who comes into possession of a copy.  This
    License will therefore apply, along with any applicable section 7
    additional terms, to the whole of the work, and all its parts,
    regardless of how they are packaged.  This License gives no
    permission to license the work in any other way, but it does not
    invalidate such permission if you have separately received it.

    d) If the work has interactive user interfaces, each must display
    Appropriate Legal Notices; however, if the Program has interactive
    interfaces that do not display Appropriate Legal Notices, your
    work need not make them do so.

  A compilation of a covered work with other separate and independent
works, which are not by their nature extensions of the covered work,
and which are not combined with it such as to form a larger program,
in or on a volume of a storage or distribution medium, is called an
"aggregate" if the compilation and its resulting copyright are not
used to limit the access or legal rights of the compilation's users
beyond what the individual works permit.  Inclusion of a covered work
in an aggregate does not cause this License to apply to the other
parts of the aggregate.

  6. Conveying Non-Source Forms.

  You may convey a covered work in object code form under the terms
of sections 4 and 5, provided that you also convey the
machine-readable Corresponding Source under the terms of this License,
in one of these ways:

    a) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by the
    Corresponding Source fixed on a durable physical medium
    customarily used for software interchange.

    b) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by a
    written offer, valid for at least three years and valid for as
    long as you offer spare parts or customer support for that product
    model, to give anyone who possesses the object code either (1) a
    copy of the Corresponding Source for all the software in the
    product that is covered by this License, on a durable physical
    medium customarily used for software interchange, for a price no
    more than your reasonable cost of physically performing this
    conveying of source, or (2) access to copy the
    Corresponding Source from a network server at no charge.

    c) Convey individual copies of the object code with a copy of the
    written offer to provide the Corresponding Source.  This
    alternative is allowed only occasionally and noncommercially, and
    only if you received the object code with such an offer, in accord
    with subsection 6b.

    d) Convey the object code by offering access from a designated
    place (gratis or for a charge), and offer equivalent access to the
    Corresponding Source in the same way through the same place at no
    further charge.  You need not require recipients to copy the
    Corresponding Source along with the object code.  If the place to
    copy the object code is a network server, the Corresponding Source
    may be on a different server (operated by you or a third party)
    that supports equivalent copying facilities, provided you maintain
    clear directions next to the object code saying where to find the
    Corresponding Source.  Regardless of what server hosts the
    Corresponding Source, you remain obligated to ensure that it is
    available for as long as needed to satisfy these requirements.

    e) Convey the object code using peer-to-peer transmission, provided
    you inform other peers where the object code and Corresponding
    Source of the work are being offered to the general public at no
    charge under subsection 6d.

  A separable portion of the object code, whose source code is excluded
from the Corresponding Source as a System Library, need not be
included in conveying the object code work.

  A "User Product" is either (1) a "consumer product", which means any
tangible personal property which is normally used for personal, family,
or household purposes, or (2) anything designed or sold for incorporation
into a dwelling.  In determining whether a product is a consumer product,
doubtful cases shall be resolved in favor of coverage.  For a particular
product received by a particular user, "normally used" refers to a
typical or common use of that class of product, regardless of the status
of the particular user or of the way in which the particular user
actually uses, or expects or is expected to use, the product.  A product
is a consumer product regardless of whether the product has substantial
commercial, industrial or non-consumer uses, unless such uses represent
the only significant mode of use of the product.

  "Installation Information" for a User Product means any methods,
procedures, authorization keys, or other information required to install
and execute modified versions of a covered work in that User Product from
a modified version of its Corresponding Source.  The information must
suffice to ensure that the continued functioning of the modified object
code is in no case prevented or interfered with solely because
modification has been made.

  If you convey an object code work under this section in, or with, or
specifically for use in, a User Product, and the conveying occurs as
part of a transaction in which the right of possession and use of the
User Product is transferred to the recipient in perpetuity or for a
fixed term (regardless of how the transaction is characterized), the
Corresponding Source conveyed under this section must be accompanied
by the Installation Information.  But this requirement does not apply
if neither you nor any third party retains the ability to install
modified object code on the User Product (for example, the work has
been installed in ROM).

  The requirement to provide Installation Information does not include a
requirement to continue to provide support service, warranty, or updates
for a work that has been modified or installed by the recipient, or for
the User Product in which it has been modified or installed.  Access to a
network may be denied when the modification itself materially and
adversely affects the operation of the network or violates the rules and
protocols for communication across the network.

  Corresponding Source conveyed, and Installation Information provided,
in accord with this section must be in a format that is publicly
documented (and with an implementation available to the public in
source code form), and must require no special password or key for
unpacking, reading or copying.

  7. Additional Terms.

  "Additional permissions" are terms that supplement the terms of this
License by making exceptions from one or more of its conditions.
Additional permissions that are applicable to the entire Program shall
be treated as though they were included in this License, to the extent
that they are valid under applicable law.  If additional permissions
apply only to part of the Program, that part may be used separately
under those permissions, but the entire Program remains governed by
this License without regard to the additional permissions.

  When you convey a copy of a covered work, you may at your option
remove any additional permissions from that copy, or from any part of
it.  (Additional permissions may be written to require their own
removal in certain cases when you modify the work.)  You may place
additional permissions on material, added by you to a covered work,
for which you have or can give appropriate copyright permission.

  Notwithstanding any other provision of this License, for material you
add to a covered work, you may (if authorized by the copyright holders of
that material) supplement the terms of this License with terms:

    a) Disclaiming warranty or limiting liability differently from the
    terms of sections 15 and 16 of this License; or

    b) Requiring preservation of specified reasonable legal notices or
    author attributions in that material or in the Appropriate Legal
    Notices displayed by works containing it; or

    c) Prohibiting misrepresentation of the origin of that material, or
    requiring that modified versions of such material be marked in
    reasonable ways as different from the original version; or

    d) Limiting the use for publicity purposes of names of licensors or
    authors of the material; or

    e) Declining to grant rights under trademark law for use of some
    trade names, trademarks, or service marks; or

    f) Requiring indemnification of licensors and authors of that
    material by anyone who conveys the material (or modified versions of
    it) with contractual assumptions of liability to the recipient, for
    any liability that these contractual assumptions directly impose on
    those licensors and authors.

  All other non-permissive additional terms are considered "further
restrictions" within the meaning of section 10.  If the Program as you
received it, or any part of it, contains a notice stating that it is
governed by this License along with a term that is a further
restriction, you may remove that term.  If a license document contains
a further restriction but permits relicensing or conveying under this
License, you may add to a covered work material governed by the terms
of that license document, provided that the further restriction does
not survive such relicensing or conveying.

  If you add terms to a covered work in accord with this section, you
must place, in the relevant source files, a statement of the
additional terms that apply to those files, or a notice indicating
where to find the applicable terms.

  Additional terms, permissive or non-permissive, may be stated in the
form of a separately written license, or stated as exceptions;
the above requirements apply either way.

  8. Termination.

  You may not propagate or modify a covered work except as expressly
provided under this License.  Any attempt otherwise to propagate or
modify it is void, and will automatically terminate your rights under
this License (including any patent licenses granted under the third
paragraph of section 11).

  However, if you cease all violation of this License, then your
license from a particular copyright holder is reinstated (a)
provisionally, unless and until the copyright holder explicitly and
finally terminates your license, and (b) permanently, if the copyright
holder fails to notify you of the violation by some reasonable means
prior to 60 days after the cessation.

  Moreover, your license from a particular copyright holder is
reinstated permanently if the copyright holder notifies you of the
violation by some reasonable means, this is the first time you have
received notice of violation of this License (for any work) from that
copyright holder, and you cure the violation prior to 30 days after
your receipt of the notice.

  Termination of your rights under this section does not terminate the
licenses of parties who have received copies or rights from you under
this License.  If your rights have been terminated and not permanently
reinstated, you do not qualify to receive new licenses for the same
material under section 10.

  9. Acceptance Not Required for Having Copies.

  You are not required to accept this License in order to receive or
run a copy of the Program.  Ancillary propagation of a covered work
occurring solely as a consequence of using peer-to-peer transmission
to receive a copy likewise does not require acceptance.  However,
nothing other than this License grants you permission to propagate or
modify any covered work.  These actions infringe copyright if you do
not accept this License.  Therefore, by modifying or propagating a
covered work, you indicate your acceptance of this License to do so.

  10. Automatic Licensing of Downstream Recipients.

  Each time you convey a covered work, the recipient automatically
receives a license from the original licensors, to run, modify and
propagate that work, subject to this License.  You are not responsible
for enforcing compliance by third parties with this License.

  An "entity transaction" is a transaction transferring control of an
organization, or substantially all assets of one, or subdividing an
organization, or merging organizations.  If propagation of a covered
work results from an entity transaction, each party to that
transaction who receives a copy of the work also receives whatever
licenses to the work the party's predecessor in interest had or could
give under the previous paragraph, plus a right to possession of the
Corresponding Source of the work from the predecessor in interest, if
the predecessor has it or can get it with reasonable efforts.

  You may not impose any further restrictions on the exercise of the
rights granted or affirmed under this License.  For example, you may
not impose a license fee, royalty, or other charge for exercise of
rights granted under this License, and you may not initiate litigation
(including a cross-claim or counterclaim in a lawsuit) alleging that
any patent claim is infringed by making, using, selling, offering for
sale, or importing the Program or any portion of it.

  11. Patents.

  A "contributor" is a copyright holder who authorizes use under this
License of the Program or a work on which the Program is based.  The
work thus licensed is called the contributor's "contributor version".

  A contributor's "essential patent claims" are all patent claims
owned or controlled by the contributor, whether already acquired or
hereafter acquired, that would be infringed by some manner, permitted
by this License, of making, using, or selling its contributor version,
but do not include claims that would be infringed only as a
consequence of further modification of the contributor version.  For
purposes of this definition, "control" includes the right to grant
patent sublicenses in a manner consistent with the requirements of
this License.

  Each contributor grants you a non-exclusive, worldwide, royalty-free
patent license under the contributor's essential patent claims, to
make, use, sell, offer for sale, import and otherwise run, modify and
propagate the contents of its contributor version.

  In the following three paragraphs, a "patent license" is any express
agreement or commitment, however denominated, not to enforce a patent
(such as an express permission to practice a patent or covenant not to
sue for patent infringement).  To "grant" such a patent license to a
party means to make such an agreement or commitment not to enforce a
patent against the party.

  If you convey a covered work, knowingly relying on a patent license,
and the Corresponding Source of the work is not available for anyone
to copy, free of charge and under the terms of this License, through a
publicly available network server or other readily accessible means,
then you must either (1) cause the Corresponding Source to be so
available, or (2) arrange to deprive yourself of the benefit of the
patent license for this particular work, or (3) arrange, in a manner
consistent with the requirements of this License, to extend the patent
license to downstream recipients.  "Knowingly relying" means you have
actual knowledge that, but for the patent license, your conveying the
covered work in a country, or your recipient's use of the covered work
in a country, would infringe one or more identifiable patents in that
country that you have reason to believe are valid.

  If, pursuant to or in connection with a single transaction or
arrangement, you convey, or propagate by procuring conveyance of, a
covered work, and grant a patent license to some of the parties
receiving the covered work authorizing them to use, propagate, modify
or convey a specific copy of the covered work, then the patent license
you grant is automatically extended to all recipients of the covered
work and works based on it.

  A patent license is "discriminatory" if it does not include within
the scope of its coverage, prohibits the exercise of, or is
conditioned on the non-exercise of one or more of the rights that are
specifically granted under this License.  You may not convey a covered
work if you are a party to an arrangement with a third party that is
in the business of distributing software, under which you make payment
to the third party based on the extent of your activity of conveying
the work, and under which the third party grants, to any of the
parties who would receive the covered work from you, a discriminatory
patent license (a) in connection with copies of the covered work
conveyed by you (or copies made from those copies), or (b) primarily
for and in connection with specific products or compilations that
contain the covered work, unless you entered into that arrangement,
or that patent license was granted, prior to 28 March 2007.

  Nothing in this License shall be construed as excluding or limiting
any implied license or other defenses to infringement that may
otherwise be available to you under applicable patent law.

  12. No Surrender of Others' Freedom.

  If conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot convey a
covered work so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you may
not convey it at all.  For example, if you agree to terms that obligate you
to collect a royalty for further conveying from those to whom you convey
the Program, the only way you could satisfy both those terms and this
License would be to refrain entirely from conveying the Program.

  13. Use with the GNU Affero General Public License.

  Notwithstanding any other provision of this License, you have
permission to link or combine any covered work with a work licensed
under version 3 of the GNU Affero General Public License into a single
combined work, and to convey the resulting work.  The terms of this
License will continue to apply to the part which is the covered work,
but the special requirements of the GNU Affero General Public License,
section 13, concerning interaction through a network will apply to the
combination as such.

  14. Revised Versions of this License.

  The Free Software Foundation may publish revised and/or new versions of
the GNU General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

  Each version is given a distinguishing version number.  If the
Program specifies that a certain numbered version of the GNU General
Public License "or any later version" applies to it, you have the
option of following the terms and conditions either of that numbered
version or of any later version published by the Free Software
Foundation.  If the Program does not specify a version number of the
GNU General Public License, you may choose any version ever published
by the Free Software Foundation.

  If the Program specifies that a proxy can decide which future
versions of the GNU General Public License can be used, that proxy's
public statement of acceptance of a version permanently authorizes you
to choose that version for the Program.

  Later license versions may give you additional or different
permissions.  However, no additional obligations are imposed on any
author or copyright holder as a result of your choosing to follow a
later version.

  15. Disclaimer of Warranty.

  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

  16. Limitation of Liability.

  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS
THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY
GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE
USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF
DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD
PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),
EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
SUCH DAMAGES.

  17. Interpretation of Sections 15 and 16.

  If the disclaimer of warranty and limitation of liability provided
above cannot be given local legal effect according to their terms,
reviewing courts shall apply local law that most closely approximates
an absolute waiver of all civil liability in connection with the
Program, unless a warranty or assumption of liability accompanies a
copy of the Program in return for a fee.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
state the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

  If the program does terminal interaction, make it output a short
notice like this when it starts in an interactive mode:

    <program>  Copyright (C) <year>  <name of author>
    This program comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type `show c' for details.

The hypothetical commands `show w' and `show c' should show the appropriate
parts of the General Public License.  Of course, your program's commands
might be different; for a GUI interface, you would use an "about box".

  You should also get your employer (if you work as a programmer) or school,
if any, to sign a "copyright disclaimer" for the program, if necessary.
For more information on this, and how to apply and follow the GNU GPL, see
<https://www.gnu.org/licenses/>.

  The GNU General Public License does not permit incorporating your program
into proprietary programs.  If your program is a subroutine library, you
may consider it more useful to permit linking proprietary applications with
the library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.  But first, please read
<https://www.gnu.org/licenses/why-not-lgpl.html>.
*/
  // END GPL LICENSE
  // BEGIN IMAGE INFO
// SPDX-License-Identifier: GPL-3.0-only
// Browser adaptation of PixaiClackHelper/NAIS3 image metadata, 2026-10-13.
// Uses bounded Uint8Array/DataView processing; no Buffer, sharp, filesystem or network.
const IMAGE_PIXEL_LIMIT=40000000;
const IMAGE_PNG_SIGNATURE=new Uint8Array([137,80,78,71,13,10,26,10]);
const IMAGE_CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);table[n]=c>>>0;}return table;})();
function imageCrc(data){let crc=0xffffffff;for(const byte of data)crc=(crc>>>8)^IMAGE_CRC_TABLE[(crc^byte)&255];return (crc^0xffffffff)>>>0;}
function imageDataView(data){return new DataView(data.buffer,data.byteOffset,data.byteLength);}
function imageU32(data,p,le=false){if(p<0||p+4>data.length)throw Error('이미지 정보 범위 오류');return imageDataView(data).getUint32(p,le);}
function imageU16(data,p,le=false){if(p<0||p+2>data.length)throw Error('이미지 정보 범위 오류');return imageDataView(data).getUint16(p,le);}
function imageLatin(data){let out='';for(let p=0;p<data.length;p+=8192)out+=String.fromCharCode(...data.subarray(p,p+8192));return out;}
function imageUtf8(data){return new TextDecoder().decode(data);}
function imageConcat(parts){const out=new Uint8Array(parts.reduce((sum,v)=>sum+v.length,0));let p=0;for(const part of parts){out.set(part,p);p+=part.length;}return out;}
function imageAbort(signal){if(signal?.aborted)throw Error('이미지 정보 읽기를 취소했습니다.');}
async function imageYield(signal){imageAbort(signal);await new Promise(resolve=>setTimeout(resolve,0));imageAbort(signal);}
async function inflateImageBytes(data,format,limit,signal){
    imageAbort(signal);if(typeof DecompressionStream!=='function')throw Error('이 브라우저는 압축 정보 읽기를 지원하지 않습니다. 최신 Chrome/Firefox에서 다시 시도해 주세요.');
    const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream(format)).getReader(),parts=[];let size=0;
    const cancel=()=>void reader.cancel().catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
    try{for(;;){imageAbort(signal);const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw Error('압축 해제 정보 용량 초과');parts.push(next.value);}imageAbort(signal);return imageConcat(parts);}
    finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});}
}
function inspectPng(data,strict=false){
    if(data.length<8||!IMAGE_PNG_SIGNATURE.every((v,i)=>data[i]===v))throw Error('PNG 형식이 아닙니다.');
    const chunks=[],warnings=[];let p=8;
    while(p+12<=data.length){const length=imageU32(data,p),end=p+length+12;if(end>data.length||chunks.length>=10000)throw Error('손상되거나 지나치게 복잡한 PNG입니다.');
        const type=imageLatin(data.subarray(p+4,p+8));if(!/^[A-Za-z]{4}$/.test(type))throw Error('PNG 청크 이름 오류');
        if(imageCrc(data.subarray(p+4,end-4))!==imageU32(data,end-4)){if(strict)throw Error('PNG 무결성 확인에 실패했습니다.');warnings.push(`${type} CRC 오류 · 원본은 수정하지 않았습니다.`);}
        chunks.push({type,start:p,end,body:data.subarray(p+8,end-4)});if(type==='IEND'){if(length)throw Error('PNG 끝 정보 오류');return {chunks,warnings};}p=end;
    }throw Error('PNG 끝 정보를 찾지 못했습니다.');
}
function imageObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function parseImageText(text){
    try{const p=imageObject(JSON.parse(text)),comment=typeof p.Comment==='string'?imageObject(JSON.parse(p.Comment)):imageObject(p.Comment),q=Object.keys(comment).length?comment:p;
        return imageInfoFields({...q,prompt:q.prompt??p.Description,negativePrompt:q.negativePrompt??q.negative_prompt??q.uc});
    }catch{const match=/(?:^|\n)Steps:\s*\d+[^\n]*$/m.exec(text);if(!match)return {};
        const prefix=text.slice(0,match.index).trim(),negative=/(?:^|\n)Negative prompt:\s*/.exec(prefix),seed=/(?:^|,\s*)Seed:\s*(\d+)/.exec(match[0].trim()),size=/(?:^|,\s*)Size:\s*(\d+)x(\d+)/.exec(match[0].trim());
        return imageInfoFields({prompt:negative?prefix.slice(0,negative.index).trim():prefix,...(negative?{negativePrompt:prefix.slice(negative.index+negative[0].length).trim()}:{}),seed:seed?Number(seed[1]):undefined,width:size?Number(size[1]):undefined,height:size?Number(size[2]):undefined});
    }
}
function readExifText(input){
    const data=imageLatin(input.subarray(0,6))==='Exif\0\0'?input.subarray(6):input,out=[];
    if(data.length<8)return out;const order=imageLatin(data.subarray(0,2)),le=order==='II';if(!le&&order!=='MM')return out;if(imageU16(data,2,le)!==42)return out;
    const seen=new Set();function visit(p){if(seen.has(p)||seen.size>=8||p<8||p+2>data.length)return;seen.add(p);const count=imageU16(data,p,le);if(count>512||p+2+count*12+4>data.length)return;
        for(let n=0;n<count;n++){const at=p+2+n*12,tag=imageU16(data,at,le),type=imageU16(data,at+2,le),size=imageU32(data,at+4,le);
            if(tag===0x8769&&type===4&&size===1){visit(imageU32(data,at+8,le));continue;}
            if(![0x10e,0x131,0x9286,0x9c9c].includes(tag)||![1,2,7].includes(type)||size>IMAGE_INFO_TEXT_LIMIT)continue;
            const pos=size<=4?at+8:imageU32(data,at+8,le);if(pos<0||pos+size>data.length)continue;let value=data.subarray(pos,pos+size),text;
            if(imageLatin(value.subarray(0,8))==='UNICODE\0'||tag===0x9c9c){if(tag!==0x9c9c)value=value.subarray(8);if(value.length%2)continue;text=new TextDecoder(tag===0x9c9c||le?'utf-16le':'utf-16be').decode(value);}
            else {if(imageLatin(value.subarray(0,8))==='ASCII\0\0\0')value=value.subarray(8);text=imageUtf8(value);}
            out.push({label:`EXIF ${tag.toString(16)}`,text:text.replace(/\0+$/g,'')});
        }
    }visit(imageU32(data,4,le));return out;
}
function inspectImageContainer(data){
    if(IMAGE_PNG_SIGNATURE.every((v,i)=>data[i]===v)){const png=inspectPng(data),header=png.chunks[0];if(header?.type!=='IHDR'||header.body.length!==13)throw Error('PNG 크기 정보 오류');if(png.chunks.some(v=>v.type==='acTL'))throw Error('정지 PNG·JPEG·WebP만 지원합니다.');return {format:'png',width:imageU32(header.body,0),height:imageU32(header.body,4),png,exif:png.chunks.filter(v=>v.type==='eXIf').map(v=>v.body),xmp:[]};}
    if(data[0]===255&&data[1]===216){let p=2,width=0,height=0;const exif=[],xmp=[];
        while(p+4<=data.length){if(data[p]!==255)throw Error('JPEG 구간 정보 오류');while(data[p]===255)p++;const marker=data[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
            const size=imageU16(data,p),end=p+size;if(size<2||end>data.length)throw Error('JPEG 정보 범위 오류');const body=data.subarray(p+2,end);
            if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&body.length>=5){height=imageU16(body,1);width=imageU16(body,3);}
            if(marker===225){if(imageLatin(body.subarray(0,6))==='Exif\0\0')exif.push(body);else if(imageLatin(body.subarray(0,29))==='http://ns.adobe.com/xap/1.0/\0')xmp.push(body.subarray(29));}p=end;
        }return {format:'jpeg',width,height,exif,xmp};
    }
    if(imageLatin(data.subarray(0,4))==='RIFF'&&imageLatin(data.subarray(8,12))==='WEBP'){
        const end=imageU32(data,4,true)+8;if(end>data.length||end<12)throw Error('WebP 크기 정보 오류');let p=12,width=0,height=0;const exif=[],xmp=[];
        while(p+8<=end){const type=imageLatin(data.subarray(p,p+4)),length=imageU32(data,p+4,true),body=data.subarray(p+8,p+8+length);if(p+8+length>end)throw Error('WebP 정보 범위 오류');
            if(type==='VP8X'&&length>=10){if(body[0]&2)throw Error('움직이는 WebP는 지원하지 않습니다.');width=1+(body[4]|body[5]<<8|body[6]<<16);height=1+(body[7]|body[8]<<8|body[9]<<16);}
            if(type==='VP8L'&&length>=5&&body[0]===47){const bits=imageU32(body,1,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
            if(type==='VP8 '&&length>=10&&body[3]===157&&body[4]===1&&body[5]===42){width=imageU16(body,6,true)&16383;height=imageU16(body,8,true)&16383;}
            if(type==='EXIF')exif.push(body);if(type==='XMP ')xmp.push(body);p+=8+length+(length%2);
        }return {format:'webp',width,height,exif,xmp};
    }throw Error('PNG·JPEG·WebP 이미지 한 장을 선택해 주세요.');
}
async function pngAlphaBytes(container,signal){
    const {width,height,png}=container,h=png.chunks[0].body,depth=h[8],color=h[9],interlace=h[12],channels=({0:1,2:3,3:1,4:2,6:4})[color];
    if(!channels||![1,2,4,8,16].includes(depth)||![0,1].includes(interlace)||h[10]||h[11])throw Error('이 PNG의 픽셀 형식은 stealth 읽기를 지원하지 않습니다.');
    const palette=png.chunks.find(v=>v.type==='tRNS')?.body;if(![4,6].includes(color)&&!palette)return null;
    if(([2,4,6].includes(color)&&![8,16].includes(depth))||(color===3&&depth===16))throw Error('잘못된 PNG 비트 깊이');
    const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
    const dimensions=passes.map(([x,y,dx,dy])=>({x,y,dx,dy,w:Math.max(0,Math.ceil((width-x)/dx)),h:Math.max(0,Math.ceil((height-y)/dy))}));
    const expected=dimensions.reduce((sum,p)=>sum+(p.w&&p.h?(1+Math.ceil(p.w*channels*depth/8))*p.h:0),0),compressed=imageConcat(png.chunks.filter(v=>v.type==='IDAT').map(v=>v.body));
    const raw=await inflateImageBytes(compressed,'deflate',expected,signal);if(raw.length!==expected)throw Error('PNG 픽셀 데이터 크기가 다릅니다.');const alpha=new Uint8Array(width*height),bpp=Math.max(1,Math.ceil(channels*depth/8));let offset=0;
    const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(const pass of dimensions){if(!pass.w||!pass.h)continue;const bytes=Math.ceil(pass.w*channels*depth/8);let previous=new Uint8Array(bytes);
        for(let y=0;y<pass.h;y++){const filter=raw[offset++],line=raw.slice(offset,offset+bytes);offset+=bytes;if(filter>4)throw Error('PNG 필터 오류');
            for(let n=0;n<line.length;n++){const a=n>=bpp?line[n-bpp]:0,b=previous[n],c=n>=bpp?previous[n-bpp]:0;line[n]=(line[n]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
            const sample=(x,c=0)=>depth===16?imageU16(line,(x*channels+c)*2):depth===8?line[x*channels+c]:(line[Math.floor(x*depth/8)]>>>(8-depth-(x*depth)%8))&((1<<depth)-1);
            for(let x=0;x<pass.w;x++){let value=255;if(color===3)value=palette[sample(x)]??255;else if(color===0)value=palette.length>=2&&sample(x)===imageU16(palette,0)?0:255;else if(color===2)value=palette.length>=6&&[0,1,2].every(c=>sample(x,c)===imageU16(palette,c*2))?0:255;else value=depth===16?sample(x,channels-1)>>>8:sample(x,channels-1);alpha[(pass.y+y*pass.dy)*width+pass.x+x*pass.dx]=value;}
            previous=line;if(y%64===0)await imageYield(signal);
        }
    }return alpha;
}
async function readStealthInfo(container,signal){
    const alpha=await pngAlphaBytes(container,signal);if(!alpha)return null;const packed=new Uint8Array(Math.ceil(alpha.length/8));let bit=0;
    for(let x=0;x<container.width;x++){for(let y=0;y<container.height;y++){if(alpha[y*container.width+x]&1)packed[bit>>>3]|=1<<(7-(bit&7));bit++;}if(x%256===0)await imageYield(signal);}
    const magic='stealth_pngcomp';if(imageLatin(packed.subarray(0,magic.length))!==magic)return null;const at=magic.length,bits=imageU32(packed,at),length=Math.ceil(bits/8);
    if(!bits||length>IMAGE_INFO_TEXT_LIMIT||at+4+length>packed.length)throw Error('stealth 정보 용량 또는 길이 오류');
    return imageUtf8(await inflateImageBytes(packed.subarray(at+4,at+4+length),'gzip',IMAGE_INFO_TEXT_LIMIT,signal));
}
async function readImageInfo(input,{signal}={}){
    if(!(input instanceof Uint8Array)||!input.length||input.length>IMAGE_INFO_MAX_BYTES)throw Error('PNG·JPEG·WebP 한 장(32MiB 이하)을 선택해 주세요.');imageAbort(signal);
    const container=inspectImageContainer(input);if(!container.width||!container.height||container.width*container.height>IMAGE_PIXEL_LIMIT)throw Error('이미지는 최대 4천만 픽셀까지 읽을 수 있습니다.');
    const result={format:container.format,width:container.width,height:container.height,sources:[],raw:[],warnings:[...(container.png?.warnings||[])]};let bytes=0,textCount=0;
    function add(label,text){bytes+=new TextEncoder().encode(text).length;if(bytes>IMAGE_INFO_TEXT_LIMIT||++textCount>128)throw Error('메타데이터 합산 용량 또는 항목 수 초과');result.raw.push({label,text});let fields;
        try{const p=imageObject(JSON.parse(text));fields=p.format===IMAGE_INFO_KEY&&p.version===1&&p.source==='local-request'?imageInfoFields({...imageObject(p.fields),seedKind:'request'}):parseImageText(text);if(p.format===IMAGE_INFO_KEY)label+=' · 요청 사본 (서버 확정값 아님)';}catch{fields=parseImageText(text);}if(Object.keys(fields).length)result.sources.push({label,fields});
    }
    if(container.png){const texts={};for(const chunk of container.png.chunks){imageAbort(signal);const b=chunk.body;if(!['tEXt','zTXt','iTXt'].includes(chunk.type))continue;if(b.length>IMAGE_INFO_TEXT_LIMIT)throw Error('PNG 텍스트 청크 용량 초과');const nul=b.indexOf(0);if(nul<1||nul>79){result.warnings.push('잘못된 PNG 텍스트 키를 제외했습니다.');continue;}const key=imageLatin(b.subarray(0,nul));let text;
            if(chunk.type==='tEXt')text=imageLatin(b.subarray(nul+1));else if(chunk.type==='zTXt'){if(b[nul+1]!==0)throw Error('지원하지 않는 PNG 압축 방식');text=imageLatin(await inflateImageBytes(b.subarray(nul+2),'deflate',IMAGE_INFO_TEXT_LIMIT-bytes,signal));}
            else {if(![0,1].includes(b[nul+1])||b[nul+2]!==0)throw Error('iTXt 압축 정보 오류');let p=nul+3;for(let n=0;n<2;n++){const end=b.indexOf(0,p);if(end<0)throw Error('iTXt 언어·번역 정보 오류');p=end+1;}text=imageUtf8(b[nul+1]===1?await inflateImageBytes(b.subarray(p),'deflate',IMAGE_INFO_TEXT_LIMIT-bytes,signal):b.subarray(p));}
            texts[key]=text;add(`PNG ${key}`,text);if(['nais3-params','nais2-params'].includes(key)){try{const decoded=Uint8Array.from(atob(text),v=>v.charCodeAt(0));add(`PNG ${key} · decoded`,imageUtf8(decoded));}catch{result.warnings.push(`${key} 로컬 기록의 압축·인코딩은 원문을 확인해 주세요.`);}}
            if(key==='XML:com.adobe.xmp')xmpDescriptions(text);
            if(key==='Description'&&text&&!result.sources.some(v=>v.fields.prompt!==undefined)){const fields=imageInfoFields({prompt:text});if(Object.keys(fields).length)result.sources.push({label:'Description 텍스트 (프롬프트로 추정)',fields});}await imageYield(signal);
        }
        if(texts.Comment&&texts.Description){try{const comment=imageObject(JSON.parse(texts.Comment));if(comment.prompt===undefined)result.sources.push({label:'PNG Comment + Description',fields:parseImageText(JSON.stringify({...comment,prompt:texts.Description}))});}catch{}}
        try{const stealth=await readStealthInfo(container,signal);if(stealth)add('PNG alpha stealth · 파일 기록',stealth);}catch(error){imageAbort(signal);if(/용량|길이|합산/.test(error.message))throw error;result.warnings.push('alpha stealth 읽기 실패: '+error.message);}
    }
    for(const exif of container.exif)for(const text of readExifText(exif))add(text.label,text.text);
    function xmpDescriptions(raw){for(const match of raw.matchAll(/<rdf:li\b[^>]*>([^<]*)<\/rdf:li>/g)){const text=match[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');if(text)add('XMP 설명',text);}}
    for(const xmp of container.xmp){const raw=imageUtf8(xmp);add('XMP 원문',raw);xmpDescriptions(raw);}
    if(!result.sources.length)result.warnings.push('적용 가능한 생성 정보가 없습니다.');if(result.sources.length>1)result.warnings.push('출처별 값은 자동으로 합치지 않습니다. 적용할 출처를 선택하세요.');if(result.sources.some(v=>v.fields.seedKind==='request'))result.warnings.push('요청 시드는 개별 결과의 확정 시드가 아닙니다.');
    result.warnings.push('파일 기록은 검증된 서버 응답이 아닙니다. NAI 전용 설정은 PixAI로 억지 변환하지 않습니다.');imageAbort(signal);return result;
}
function embedGenerationInfo(input,job,mediaId){
    const data=new Uint8Array(input),{chunks}=inspectPng(data,true),p=job.apiPayload;if(!p)throw Error('확정된 API 요청이 없습니다.');
    const fields=imageInfoFields({prompt:p.prompt,negativePrompt:p.negativePrompt,modelId:job.configuration?.model.id,modelVersionId:p.modelVersionId,loras:(p.loras||[]).map((v,index)=>({id:job.configuration?.loras[index]?.id,versionId:v.modelId,weight:v.weight})),seed:p.seed,seedKind:'request',batchSize:p.batchSize,aspectRatio:p.aspectRatio,size:p.size,mode:p.mode,style:p.style?.key});
    const json=new TextEncoder().encode(JSON.stringify({format:IMAGE_INFO_KEY,version:1,source:'local-request',fields,taskId:job.taskId,mediaId}));if(json.length>IMAGE_INFO_TEXT_LIMIT)throw Error('생성 정보 용량 초과');
    const body=imageConcat([new TextEncoder().encode(IMAGE_INFO_KEY+'\0\0\0\0\0'),json]),chunk=new Uint8Array(body.length+12);imageDataView(chunk).setUint32(0,body.length);chunk.set(new TextEncoder().encode('iTXt'),4);chunk.set(body,8);imageDataView(chunk).setUint32(chunk.length-4,imageCrc(chunk.subarray(4,-4)));const end=chunks.find(v=>v.type==='IEND').start;
    return imageConcat([data.subarray(0,end),chunk,data.subarray(end)]);
}
function importedImagePreset(fields,name,id){if(fields.modelIncomplete||!fields.modelId||!fields.modelVersionId||fields.loras?.some(v=>!v.id))throw Error('모델·LoRA 부모 ID와 버전 ID가 모두 필요합니다.');return {id,name,model:{id:fields.modelId,versionId:fields.modelVersionId,name:''},loras:(fields.loras||[]).map(v=>({id:v.id,versionId:v.versionId,name:'',weight:v.weight,triggerWords:''}))};}
async function prepareImageForSave(blob,job,mediaId,persist=()=>{}) {if(job.embedMetadata!==true||blob.type!=='image/png')return blob;try{return new Blob([embedGenerationInfo(new Uint8Array(await blob.arrayBuffer()),job,mediaId)],{type:'image/png'});}catch{job.metadataWarnings={...(job.metadataWarnings||{}),[mediaId]:'생성 요청 정보를 추가하지 못해 검증된 다운로드 원본 그대로 저장했습니다.'};persist();return blob;}}
function importImageComposition(library,recipe,value,selected,options={}){
    const next=JSON.parse(JSON.stringify(normalizePresetLibrary(library))),fields=imageInfoFields(value),id=options.idFactory||(()=>crypto.randomUUID()),name=options.name||'이미지에서 가져온 조합';if(!Object.values(selected).some(Boolean))throw Error('적용할 정보를 선택해 주세요.');
    const oldPreset=next.presets.find(v=>v.id===recipe.presetId),oldCharacter=next.characters.find(v=>v.id===recipe.characterId),chunks=recipe.sceneIds.map(key=>next.scenes.find(v=>v.id===key));if(chunks.some(v=>!v))throw Error('현재 조합의 청크 연결을 먼저 확인해 주세요.');
    const current=composePresetPrompts(resolvePresetCommon(next,oldPreset),oldCharacter||{},chunks,oldPreset||{loras:[]},recipe.triggerPosition);
    if(selected.prompt&&fields.prompt===undefined||selected.negativePrompt&&fields.negativePrompt===undefined)throw Error('선택한 문구가 파일에 없습니다.');
    const preset=selected.model?importedImagePreset(fields,name,id()):oldPreset?{id:id(),name,model:{...oldPreset.model},loras:oldPreset.loras.map(v=>({...v,triggerWords:''}))}:null;if(!preset)throw Error('조합 예약에서 사용할 PixAI 프리셋을 먼저 골라 주세요.');
    const common={id:id(),name:name+' · 추가 공통문 없음',prompt:'',negativePrompt:''},character={id:id(),name:name+' · 추가 캐릭터 문구 없음',prompt:'',negativePrompt:''},chunk={id:id(),name,prompt:selected.prompt?fields.prompt:current.prompt,negativePrompt:selected.negativePrompt?fields.negativePrompt:current.negativePrompt};preset.commonPresetId=common.id;
    next.commonPresets=[...(next.commonPresets||[]),common];next.presets.push(preset);next.characters.push(character);next.scenes.push(chunk);const images={...recipe.imageOptions};if(selected.image)for(const key of ['aspectRatio','size','mode','batchSize'])if(fields[key]!==undefined)images[key]=fields[key];
    return {library:normalizePresetLibrary(next),recipe:{presetId:preset.id,characterId:character.id,sceneIds:[chunk.id],count:1,triggerPosition:'end',imageOptions:images},api:{...(selected.seed&&fields.seed!==undefined?{seed:String(fields.seed)}:{}),...(selected.style&&fields.style?{style:fields.style}:{})}};
}
  // END IMAGE INFO
  // BEGIN PARITY UI
// SPDX-License-Identifier: GPL-3.0-only
// PixAI browser UI additions, 2026-10-13. No remote assets or framework runtime.
function ratioDescription(ratio) {const [w,h]=String(ratio).split(':').map(Number);return w===h?'정사각형':w>h?'가로형':'세로형';}
function parityEnabled(control,enabled,ctx){control.dataset.unavailable=String(!enabled);control.disabled=!enabled||!!ctx?.io?.isBusy?.();}
function ratioMark(el,ratio) {const [w,h]=String(ratio).split(':').map(Number),mark=el('span',null,{class:'pq-ratio-mark','aria-hidden':'true'});const scale=22/Math.max(w,h);mark.style.width=`${w*scale}px`;mark.style.height=`${h*scale}px`;return mark;}
function previewMaterial(el,value={}) {const wrap=el('div',null,{class:'pq-material-preview'});wrap.append(el('p',value.prompt||'포지 없음',{class:'pq-preview-positive'}),el('p',value.negativePrompt?`네거: ${value.negativePrompt}`:'네거 없음',{class:'pq-preview-negative'}));return wrap;}
function presetPreviewText(library,item){try {const common=resolvePresetCommon(library,item),join=(...parts)=>parts.map(presetText).filter(Boolean).join(', ');return {prompt:join(common.prompt,item.prompt),negativePrompt:join(common.negativePrompt,item.negativePrompt)};}catch(error){return {prompt:error.message,negativePrompt:item.negativePrompt||''};}}
async function readPublicModelName(info,io={}) {
    if(parsePublicModelLink(info.url).url!==info.url)throw Error('정규 PixAI 공개 모델 주소만 조회할 수 있습니다.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try {const response=await (io.fetch||fetch)(info.url,{credentials:'omit',redirect:'error',signal:controller.signal});
        if(!response.ok||response.url!==info.url||!response.headers.get('content-type')?.includes('text/html'))throw Error('공개 이름 조회 실패');
        let html='',bytes=0;const decoder=new TextDecoder(),reader=response.body?.getReader();if(!reader)throw Error('공개 페이지 내용 없음');
        try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>2*1024*1024)throw Error('공개 페이지 크기 초과');html+=decoder.decode(part.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
        const title=/<title\b[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.replace(/\s*[-|]\s*PixAI.*$/i,'').trim();
        return {...info,...(title?{name:title.replace(/&amp;/g,'&').replace(/&quot;/g,'"').slice(0,200)}:{})};
    } catch {return {...info,notice:info.notice+' 이름 조회 실패 · ID는 유지했습니다. 이름을 직접 입력할 수 있습니다.'};}
    finally {clearTimeout(timer);}
}
function publicLinkEditor(ctx,label,onApply){const {el,action,field}=ctx,input=field(label,'input',{type:'url',placeholder:'https://pixai.art/ko/model/모델ID/버전ID'}),status=el('div',null,{role:'status'}),box=el('details');let candidate=null;const apply=action('읽은 정보 적용',()=>{if(!candidate)throw Error('링크를 먼저 읽으세요.');onApply(candidate);status.textContent='편집 칸에 적용했습니다. 프리셋 저장을 눌러 확정하세요.';});parityEnabled(apply,false);box.append(el('summary',label),input.wrap,action('링크 정보 읽기',async()=>{candidate=null;parityEnabled(apply,false);status.textContent='공개 링크 정보 읽는 중…';try{candidate=await readPublicModelName(parsePublicModelLink(input.input.value));status.textContent=`모델 ID ${candidate.id} · 버전 ID ${candidate.versionId||'(없음)'} · ${candidate.name||'이름 직접 입력'}\n${candidate.notice}\n링크 읽기는 LoRA 트리거 자동 추출을 하지 않습니다.`;parityEnabled(apply,true);}catch(error){status.textContent=error.message;}}),status,apply);return box;}
function mountCommonPresetSets(ctx) {
    const {el,action,field,commonBody}=ctx,copy=value=>JSON.parse(JSON.stringify(value));
    const defaultPanel=el('details',null,{class:'pq-common-default'});defaultPanel.append(el('summary','기본 공통문 · 연결 없는 프리셋에서 사용'),...commonBody.children);commonBody.replaceChildren(defaultPanel);
    const list=el('div',null,{class:'pq-saved-list','aria-label':'공통문 세트 목록'}),form=el('div',null,{class:'pq-common-editor'}),layout=el('div',null,{class:'pq-parity-split'});
    const name=field('공통문 세트 이름'),prompt=field('세트 포지','textarea'),negative=field('세트 네거','textarea'),status=el('small',null,{role:'status'});
    let selected='',baseline=null,conflict=false;
    const values=()=>({name:name.input.value,prompt:prompt.input.value,negativePrompt:negative.input.value});
    const dirty=()=>JSON.stringify(values())!==JSON.stringify(baseline?{name:baseline.name,prompt:baseline.prompt,negativePrompt:baseline.negativePrompt}:{name:'',prompt:'',negativePrompt:''});
    function fill(value){selected=value?.id||'';baseline=value?copy(value):null;name.input.value=value?.name||'';prompt.input.value=value?.prompt||'';negative.input.value=value?.negativePrompt||'';conflict=false;refresh();}
    async function save(){if(conflict)throw Error('편집 중 저장된 세트가 바뀌었습니다. 새 값 다시 읽기 또는 복제 저장을 선택해 주세요.');
        const item={id:selected||crypto.randomUUID(),name:name.input.value.trim(),prompt:prompt.input.value.trim(),negativePrompt:negative.input.value.trim()};if(!item.name)throw Error('공통문 세트 이름을 입력해 주세요.');
        if(selected&&!ctx.getLibrary().commonPresets?.some(v=>v.id===selected))throw Error('이 세트는 삭제됐습니다. 새 세트 또는 복제 저장으로 만드세요.');
        const next=copy(ctx.getLibrary());next.commonPresets=next.commonPresets||[];const at=next.commonPresets.findIndex(v=>v.id===item.id);if(at<0)next.commonPresets.push(item);else next.commonPresets[at]=item;
        await ctx.commit(next,'공통문 세트를 저장했습니다. 기존 예약 사본은 유지됩니다.');fill(item);
    }
    function refresh(){const library=ctx.getLibrary(),live=library.commonPresets?.find(v=>v.id===selected);
        if(baseline&&JSON.stringify(live)!==JSON.stringify(baseline)){if(dirty())conflict=true;else {baseline=live?copy(live):null;selected=live?.id||'';name.input.value=live?.name||'';prompt.input.value=live?.prompt||'';negative.input.value=live?.negativePrompt||'';}}
        list.replaceChildren();for(const item of library.commonPresets||[]){const row=el('div',null,{class:'pq-parity-card'}),control=action(item.name,()=>ctx.confirmDraft(dirty(),save,()=>fill(library.commonPresets?.find(v=>v.id===selected)),()=>fill(item)));control.setAttribute('aria-pressed',String(item.id===selected));control.setAttribute('aria-label',`공통문 세트 편집: ${item.name}`);row.append(control,previewMaterial(el,item));list.append(row);}
        if(!list.children.length)list.append(el('small','이름 있는 공통문 세트를 만들어 프리셋에 연결하세요.'));
        status.textContent=conflict?'저장된 세트가 변경·삭제됨 · 편집 내용 유지 중':dirty()?'저장 안 됨':selected?'저장됨':'새 세트 · 저장 전';parityEnabled(saveButton,!conflict,ctx);
        ctx.refreshCommonChoices();
    }
    const saveButton=action('공통문 세트 저장',save),create=action('새 공통문 세트',()=>ctx.confirmDraft(dirty(),save,()=>fill(baseline),()=>fill(null)));
    const duplicate=action('공통문 복제 저장',async()=>{const next=copy(ctx.getLibrary()),item={id:crypto.randomUUID(),name:(name.input.value.trim()||'공통문')+' (복사본)',prompt:prompt.input.value,negativePrompt:negative.input.value};next.commonPresets=[...(next.commonPresets||[]),item];await ctx.commit(next,'새 공통문 세트로 복제했습니다.');fill(item);});
    const remove=action('공통문 세트 삭제',()=>{if(!selected)throw Error('삭제할 저장 세트를 골라 주세요.');const count=ctx.getLibrary().presets.filter(v=>v.commonPresetId===selected).length;ctx.confirm(`연결 프리셋 ${count}개는 기본 공통문으로 돌아갑니다. 기존 예약 사본은 유지합니다.`,async()=>{await ctx.commit(deleteCommonPreset(ctx.getLibrary(),selected),'공통문 세트를 삭제하고 연결을 해제했습니다.');fill(null);});});
    form.append(status,name.wrap,prompt.wrap,negative.wrap,saveButton,duplicate,remove,action('새 값 다시 읽기',()=>fill(ctx.getLibrary().commonPresets?.find(v=>v.id===selected))));
    for(const control of [name.input,prompt.input,negative.input])control.addEventListener('input',()=>{status.textContent=dirty()?'저장 안 됨':'저장됨';});
    const browse=el('div');browse.append(create,list);ctx.resizable(layout,[browse,form],'공통문 세트',[.44,.56],[240,260]);commonBody.append(layout);refresh();
    return {refresh,dirty,save,discard:()=>fill(ctx.getLibrary().commonPresets?.find(v=>v.id===selected))};
}
function mountParityWorkspace(ctx) {
    ctx.root.append(ctx.el('style',`
#local-pixai-queue [data-page="studio"]{padding:0;overflow:hidden}
#local-pixai-queue .pq-studio-layout>div:not(.pq-pane-handle){min-width:0;min-height:0;height:100%;overflow:auto;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:9px;overscroll-behavior:contain}
#local-pixai-queue .pq-studio-layout{height:auto;flex:1}
#local-pixai-queue .pq-studio-list{min-height:90px;max-height:38vh;overflow:auto;flex:none;overscroll-behavior:contain}
#local-pixai-queue .pq-studio-list .pq-parity-card{position:relative}
#local-pixai-queue .pq-studio-choice .pq-choice-list,#local-pixai-queue .pq-studio-image-grid .pq-choice-list{max-height:110px;overflow:auto;display:flex;flex-wrap:wrap;align-content:start;gap:4px}
#local-pixai-queue .pq-studio-selected{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow:auto}
#local-pixai-queue .pq-studio-selected .pq-parity-card{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
#local-pixai-queue .pq-studio-image-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
#local-pixai-queue .pq-studio-image-grid>div:first-child{grid-column:1/-1}
#local-pixai-queue .pq-studio-matrix{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;max-height:220px;overflow:auto}
#local-pixai-queue .pq-studio-notice{white-space:pre-wrap;color:var(--pq-muted);overflow-wrap:anywhere}
#local-pixai-queue .pq-studio-mode{display:none}
#local-pixai-queue .pq-parity-card[data-drop-position="before"]{border-top:2px solid var(--pq-accent)}
#local-pixai-queue .pq-parity-card[data-drop-position="after"]{border-bottom:2px solid var(--pq-accent)}
#local-pixai-queue .pq-scene-thumbnail{width:72px;height:54px;object-fit:contain;float:right;border-radius:5px;background:var(--pq-bg)}
#local-pixai-queue .pq-batch-group{border:1px solid var(--pq-line);border-radius:7px;padding:8px;margin:7px 0}
#local-pixai-queue .pq-batch-group>summary{cursor:pointer;font-size:14px;font-weight:600;overflow-wrap:anywhere}
#local-pixai-queue .pq-image-drop{border:1px dashed var(--pq-muted);border-radius:8px;padding:14px;flex:none}
#local-pixai-queue .pq-image-preview{max-width:100%;max-height:240px;width:auto;object-fit:contain;align-self:start}
#local-pixai-queue [data-page="image-info"]{overflow:auto;gap:10px;overscroll-behavior:contain}
#local-pixai-queue [data-page="image-info"] pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto;font-size:13px}
#local-pixai-queue [data-compatibility-preview] p{white-space:pre-wrap}
#local-pixai-queue .pq-confirm{max-height:75%;overflow:auto;overscroll-behavior:contain;white-space:pre-wrap}
@container pqwin (max-width:760px){
#local-pixai-queue .pq-studio-mode{display:flex;gap:5px;padding:8px;flex:none;flex-wrap:wrap}
#local-pixai-queue .pq-studio-mode button{flex:1;margin:0;font-size:13px;padding:8px}
#local-pixai-queue .pq-studio-layout{display:flex!important;overflow:hidden}
#local-pixai-queue .pq-studio-layout>div:not(.pq-pane-handle){flex:1!important;width:100%;height:100%}
#local-pixai-queue [data-studio-mode="materials"] .pq-studio-editor,#local-pixai-queue [data-studio-mode="materials"] .pq-studio-schedule,
#local-pixai-queue [data-studio-mode="editor"] .pq-studio-materials,#local-pixai-queue [data-studio-mode="editor"] .pq-studio-schedule,
#local-pixai-queue [data-studio-mode="schedule"] .pq-studio-materials,#local-pixai-queue [data-studio-mode="schedule"] .pq-studio-editor{display:none!important}
#local-pixai-queue .pq-studio-list{max-height:45vh}
}
`));
    const {el,action}=ctx,box=el('div',null,{class:'pq-confirm',role:'alertdialog','aria-label':'편집 내용 확인'});box.hidden=true;ctx.root.append(box);
    function confirm(text,run){box.replaceChildren(el('p',text),action('확인',async()=>{await run();box.hidden=true;}),action('취소',()=>{box.hidden=true;}));box.hidden=false;}
    function confirmDraft(dirty,save,discard,next){if(!dirty){next();return;}box.replaceChildren(el('p','저장하지 않은 편집 내용이 있습니다.'),action('저장하고 이동',async()=>{await save();box.hidden=true;next();}),action('버리고 이동',()=>{discard();box.hidden=true;next();}),action('편집 계속',()=>{box.hidden=true;}));box.hidden=false;}
    const full={...ctx,confirm,confirmDraft},common=mountCommonPresetSets(full),studio=mountSceneStudio(full),info=typeof mountImageInfoPanel==='function'?mountImageInfoPanel(full):null;
    function requestNavigation(id,next){const editor=[common,studio,studio.castEditor].find(v=>v.dirty());if(editor){confirmDraft(true,editor.save,editor.discard,()=>{if(!requestNavigation(id,next))next();});return true;}return false;}
    return {refresh(){common.refresh();studio.refresh();},requestNavigation,confirm,confirmDraft,studio,info};
}
function mountCastTools(ctx,tools,changed){
    const {el,field,action}=ctx,copy=v=>JSON.parse(JSON.stringify(v)),name=field('출연 이름'),positive=field('출연 추가 포지','textarea'),negative=field('출연 추가 네거','textarea'),choices=el('div'),list=el('div',null,{class:'pq-studio-list'}),status=el('small',null,{role:'status'}),selected=new Set();
    let characterId='',presetId='',castId='',baseline=null;
    const values=()=>({name:name.input.value,characterId,presetId,extra:{prompt:positive.input.value,negativePrompt:negative.input.value}});
    const dirty=()=>JSON.stringify(values())!==JSON.stringify(baseline?{name:baseline.name,characterId:baseline.characterId,presetId:baseline.presetId,extra:baseline.extra||{prompt:'',negativePrompt:''}}:{name:'',characterId:'',presetId:'',extra:{prompt:'',negativePrompt:''}});
    function fill(item){castId=item?.id||'';baseline=item?copy(item):null;characterId=item?.characterId||'';presetId=item?.presetId||'';name.input.value=item?.name||'';positive.input.value=item?.extra?.prompt||'';negative.input.value=item?.extra?.negativePrompt||'';refresh();}
    async function save(){const lib=ctx.getLibrary();if(baseline&&JSON.stringify(lib.casts?.find(v=>v.id===castId))!==JSON.stringify(baseline))throw Error('편집 중 출연이 변경·삭제됐습니다. 새 값 다시 읽기를 선택하세요.');const item={id:castId||crypto.randomUUID(),...values(),name:name.input.value.trim(),...(baseline?.triggerPosition!==undefined?{triggerPosition:baseline.triggerPosition}:{})};if(!item.name)throw Error('출연 이름을 입력하세요.');if(!lib.characters.some(v=>v.id===characterId)||!lib.presets.some(v=>v.id===presetId))throw Error('출연 캐릭터와 프리셋을 선택하세요.');const next=copy(lib);next.casts=next.casts||[];const at=next.casts.findIndex(v=>v.id===item.id);if(at<0)next.casts.push(item);else next.casts[at]=item;await ctx.commit(next,'출연을 저장했습니다. 원본 캐릭터와 예약은 유지됩니다.');fill(ctx.getLibrary().casts.find(v=>v.id===item.id));changed();}
    async function modify(operation,ids){if(!ids.length)throw Error('출연을 선택하세요.');const next=copy(ctx.getLibrary());if(ids.some(id=>!next.casts?.some(v=>v.id===id)))throw Error('목록이 바뀌었습니다. 다시 선택하세요.');if(operation==='delete')next.casts=next.casts.filter(v=>!ids.includes(v.id));else next.casts=next.casts.flatMap(v=>ids.includes(v.id)?[v,{...copy(v),id:crypto.randomUUID(),name:v.name+' (복사본)'}]:[v]);await ctx.commit(next,operation==='delete'?'출연을 삭제했습니다. 예약 사본은 유지됩니다.':'출연을 복제했습니다.');if(operation==='delete'){selected.clear();if(ids.includes(castId))fill(null);}changed();refresh();}
    function refresh(){const lib=ctx.getLibrary(),live=lib.casts?.find(v=>v.id===castId);if(baseline&&JSON.stringify(live)!==JSON.stringify(baseline)&&!dirty()){castId=live?.id||'';baseline=live?copy(live):null;characterId=live?.characterId||'';presetId=live?.presetId||'';name.input.value=live?.name||'';positive.input.value=live?.extra?.prompt||'';negative.input.value=live?.extra?.negativePrompt||'';}
        choices.replaceChildren(parityChoice(ctx,'출연 원본 캐릭터',lib.characters.map(v=>({id:v.id,name:v.name})),characterId,id=>{characterId=id;refresh();}),parityChoice(ctx,'출연·기본 프리셋',lib.presets.map(v=>({id:v.id,name:v.name})),presetId,id=>{presetId=id;refresh();}));list.replaceChildren();
        for(const item of lib.casts||[]){const row=el('div',null,{class:'pq-parity-card'}),selection=field('출연 관리 선택: '+item.name,'input',{type:'checkbox'});selection.input.checked=selected.has(item.id);selection.input.addEventListener('change',()=>{if(selection.input.checked)selected.add(item.id);else selected.delete(item.id);});row.append(selection.wrap,parityDrag(ctx,row,item.id,lib.casts.map(v=>v.id),async ids=>{const next=copy(ctx.getLibrary());next.casts=ids.map(id=>next.casts.find(v=>v.id===id));await ctx.commit(next,'출연 순서를 저장했습니다.');changed();},'출연 목록'),action('출연 편집: '+item.name,()=>ctx.confirmDraft(dirty(),save,()=>fill(lib.casts?.find(v=>v.id===castId)),()=>fill(item))),previewMaterial(el,item.extra));list.append(row);}
        status.textContent=baseline&&JSON.stringify(live)!==JSON.stringify(baseline)?'저장된 출연 변경·삭제됨 · 초안 유지':dirty()?'저장 안 됨':castId?'저장됨':'새 출연 · 저장 전';
    }
    const discard=()=>fill(ctx.getLibrary().casts?.find(v=>v.id===castId));
    tools.append(status,choices,list,name.wrap,positive.wrap,negative.wrap,action('캐릭터 기본 프리셋 저장',async()=>{const next=copy(ctx.getLibrary()),character=next.characters.find(v=>v.id===characterId);if(!character||!next.presets.some(v=>v.id===presetId))throw Error('캐릭터와 프리셋을 골라 주세요.');character.defaultPresetId=presetId;await ctx.commit(next,'캐릭터 기본 프리셋을 저장했습니다.');changed();}),action('출연 저장',save),action('새 출연',()=>ctx.confirmDraft(dirty(),save,discard,()=>fill(null))),action('출연 새 값 다시 읽기',discard),action('출연 복제',()=>modify('duplicate',[castId].filter(Boolean))),action('출연 삭제',()=>ctx.confirm('출연만 삭제하고 원본 캐릭터와 예약은 유지합니다.',()=>modify('delete',[castId].filter(Boolean)))),action('선택 출연 복제',()=>modify('duplicate',[...selected])),action('선택 출연 삭제',()=>ctx.confirm('선택한 출연만 삭제합니다. 원본 캐릭터와 예약 사본은 유지됩니다.',()=>modify('delete',[...selected]))));
    for(const input of [name.input,positive.input,negative.input])input.addEventListener('input',()=>{status.textContent=dirty()?'저장 안 됨':'저장됨';});refresh();return {refresh,dirty,save,discard};
}
function mountImageInfoPanel(ctx){
    const {el,field,action}=ctx,body=ctx.addPage('image-info','이미지 정보'),chooser=field('이미지 한 장 선택','input',{type:'file',accept:'image/png,image/jpeg,image/webp'}),drop=el('div','PNG/JPEG/WebP 이미지 한 장을 여기에 놓으세요.',{class:'pq-image-drop'}),preview=el('img',null,{class:'pq-image-preview',alt:'선택한 이미지 미리보기'}),status=el('p',null,{role:'status'}),sources=el('div',null,{class:'pq-choice-list','aria-label':'생성 정보 출처'}),fields=el('div'),raw=el('details'),name=field('가져온 재료 이름');
    let controller=null,result=null,selection={},sourceIndex=-1,previewUrl=null;
    name.input.value='이미지에서 가져온 재료';raw.append(el('summary','기록 원문 · 지원하지 않는 값 포함'));const texts=el('div');raw.append(texts);
    const emptySelection=()=>({prompt:false,negativePrompt:false,model:false,image:false,seed:false,style:false});
    function normalized(){return imageInfoFields(result?.sources[sourceIndex]?.fields||{});}
    function render(){sources.replaceChildren();for(const [index,source] of (result?.sources||[]).entries()){const control=action(source.label,()=>{sourceIndex=index;selection=emptySelection();render();});control.setAttribute('aria-pressed',String(index===sourceIndex));sources.append(control);}fields.replaceChildren();const f=normalized();
        const modelComplete=!f.modelIncomplete&&!!f.modelId&&!!f.modelVersionId&&!f.loras?.some(v=>!v.id),available={prompt:f.prompt!==undefined,negativePrompt:f.negativePrompt!==undefined,model:modelComplete,image:['aspectRatio','size','batchSize','mode'].some(key=>f[key]!==undefined),seed:f.seed!==undefined,style:!!f.style&&API_STYLES.includes(f.style)};
        for(const [key,label] of [['prompt','포지 적용'],['negativePrompt','네거 적용 (빈 값도 명시적으로 적용)'],['model','모델·LoRA 적용'],['image','지원 이미지 옵션 적용'],['seed','시드를 다음 등록의 공통 옵션에 적용'],['style','스타일을 다음 등록의 공통 옵션에 적용']]){const control=field(label,'input',{type:'checkbox'});control.input.checked=!!selection[key];control.input.disabled=!available[key];control.input.dataset.unavailable=String(!available[key]);control.input.addEventListener('change',()=>{selection[key]=control.input.checked;parityEnabled(apply,Object.values(selection).some(Boolean),ctx);});fields.append(control.wrap);}
        if(f.modelVersionId&&!modelComplete)fields.append(el('small','모델/LoRA 부모 ID 또는 버전 ID가 부족해 모델 적용은 꺼져 있습니다. 숫자 ID를 추정하지 않습니다.'));
        fields.append(previewMaterial(el,{prompt:f.prompt||'',negativePrompt:f.negativePrompt||''}),el('pre',JSON.stringify({...f,prompt:undefined,negativePrompt:undefined},null,2)));
        if(f.seedKind==='request')fields.append(el('strong','이 시드는 요청 시드이며, 개별 결과의 확정 시드가 아닙니다.'));
        parityEnabled(apply,Object.values(selection).some(Boolean),ctx);parityEnabled(savePreset,modelComplete,ctx);
    }
    async function read(file){controller?.abort();controller=new AbortController();const own=controller;result=null;sourceIndex=-1;selection=emptySelection();sources.replaceChildren();fields.replaceChildren();texts.replaceChildren();parityEnabled(apply,false,ctx);parityEnabled(savePreset,false,ctx);if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}preview.removeAttribute?.('src');status.textContent='이미지 정보 읽는 중…';try{if(!file||file.size>IMAGE_INFO_MAX_BYTES)throw Error('이미지 한 장(32MiB 이하)을 선택하세요.');const info=await readImageInfo(new Uint8Array(await file.arrayBuffer()),{signal:own.signal});if(own!==controller)return;result=info;status.textContent=`${info.format.toUpperCase()} · ${info.width}×${info.height}\n`+info.warnings.join('\n');sourceIndex=info.sources.length?0:-1;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(new Blob([await file.arrayBuffer()],{type:info.format==='jpeg'?'image/jpeg':'image/'+info.format}));preview.src=previewUrl;texts.replaceChildren(...info.raw.map(v=>{const item=el('details');item.append(el('summary',v.label),el('pre',v.text));return item;}));render();}catch(error){if(own!==controller)return;status.textContent=error.message;result=null;sources.replaceChildren();fields.replaceChildren();parityEnabled(apply,false,ctx);parityEnabled(savePreset,false,ctx);}finally{if(own===controller)controller=null;}}
    chooser.input.addEventListener('change',()=>{if(chooser.input.files?.length!==1){status.textContent='이미지 한 장을 선택하세요.';return;}return read(chooser.input.files[0]);});
    drop.addEventListener('dragover',event=>{event.preventDefault();drop.dataset.dropActive='true';});drop.addEventListener('dragleave',()=>{drop.dataset.dropActive='false';});drop.addEventListener('drop',event=>{event.preventDefault();drop.dataset.dropActive='false';if(event.dataTransfer?.files?.length!==1){status.textContent='이미지 한 장만 놓아 주세요.';return;}return read(event.dataTransfer.files[0]);});
    const apply=action('선택한 정보로 조합 열기',()=>{if(ctx.io.isRunning?.())throw Error('실행 중인 작업이 끝난 뒤 적용하세요.');const f=normalized();ctx.confirm('새 공통문 세트·프리셋·빈 캐릭터·청크를 만듭니다. 최종 문구를 그대로 사용하며 기존 문구를 다시 붙이지 않습니다. 시드/스타일을 골랐다면 이후 등록의 공통 옵션도 바뀝니다.',async()=>{const expected=ctx.getLibrary(),imported=importImageComposition(expected,ctx.getRecipe(),f,selection,{name:name.input.value.trim()||'이미지 재료'});if(ctx.io.applyImageComposition){await ctx.io.applyImageComposition(imported,expected);ctx.reloadLibrary();}else await ctx.commit(imported.library,'이미지 문구를 새 재료로 저장했습니다.');ctx.loadRecipe(imported.recipe);status.textContent='선택 정보를 새 조합에 적용했습니다. 생성·대기열 등록은 하지 않았습니다.';});});
    const saveChunk=action('청크로 저장',async()=>{const f=normalized();if(f.prompt===undefined&&f.negativePrompt===undefined)throw Error('저장할 문구가 없습니다.');const next=JSON.parse(JSON.stringify(ctx.getLibrary()));next.scenes.push({id:crypto.randomUUID(),name:name.input.value.trim()||'이미지 청크',prompt:f.prompt||'',negativePrompt:f.negativePrompt||''});await ctx.commit(next,'이미지 문구를 청크로 저장했습니다.');});
    const savePreset=action('이미지 프리셋으로 저장',async()=>{const next=JSON.parse(JSON.stringify(ctx.getLibrary()));next.presets.push(importedImagePreset(normalized(),name.input.value.trim()||'이미지 프리셋',crypto.randomUUID()));await ctx.commit(next,'모델·LoRA를 프리셋으로 저장했습니다.');});
    const top=el('div',null,{class:'pq-image-information'}),detail=el('div',null,{class:'pq-image-details'}),layout=el('div',null,{class:'pq-parity-split'});top.append(chooser.wrap,drop,preview,status,action('이미지 읽기 취소',()=>{controller?.abort();status.textContent='읽기 취소 요청';}));detail.append(el('strong','읽기만으로 설정·조합을 바꾸거나 업로드하지 않습니다.'),sources,fields,name.wrap,apply,saveChunk,savePreset,raw);ctx.resizable(layout,[top,detail],'이미지 정보',[.38,.62],[240,280]);body.append(layout);parityEnabled(apply,false,ctx);parityEnabled(savePreset,false,ctx);
    const dispose=()=>{controller?.abort();if(previewUrl)URL.revokeObjectURL(previewUrl);};if(typeof window!=='undefined')window.addEventListener('pagehide',dispose,{once:true});return {dispose};
}
function parityChoice(ctx,label,items,value,onChange) {
    const {el}=ctx,wrap=el('div',null,{class:'pq-studio-choice'}),list=el('div',null,{class:'pq-choice-list','aria-label':label});wrap.append(el('strong',label),list);
    for(const item of items){const control=ctx.action(item.name,()=>onChange(item.id));control.setAttribute('aria-label',`${label}: ${item.name}`);control.setAttribute('aria-pressed',String(item.id===value));if(item.ratio){control.replaceChildren(ratioMark(el,item.ratio),el('span',`${item.name} · ${ratioDescription(item.ratio)}`));}list.append(control);}return wrap;
}
function parityDrag(ctx,row,id,ids,onOrder,label) {
    const {el}=ctx,type='application/x-pixai-studio-order',handle=el('button','⠿',{type:'button',draggable:'true','aria-label':`${label} 이동: ${id}`,'data-edit':''});
    handle.addEventListener('dragstart',event=>{if(event.isTrusted===false||ctx.io.isBusy?.()||ctx.parityDragBusy){event.preventDefault();return;}event.stopPropagation();ctx.parityDragSession={label,id};event.dataTransfer?.setData(type,JSON.stringify({label,id}));});handle.addEventListener('dragend',()=>{ctx.parityDragSession=null;});handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
    row.addEventListener('dragover',event=>{if(event.isTrusted!==false&&!ctx.io.isBusy?.()){event.preventDefault();row.dataset.dropPosition=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2?'after':'before';}});
    row.addEventListener('dragleave',()=>{row.dataset.dropPosition='';});
    row.addEventListener('drop',event=>{row.dataset.dropPosition='';if(event.isTrusted===false||ctx.io.isBusy?.()||ctx.parityDragBusy)return;event.preventDefault();event.stopPropagation();try{const source=JSON.parse(event.dataTransfer?.getData(type)||'null');if(source?.label!==label||source.id!==ctx.parityDragSession?.id||label!==ctx.parityDragSession?.label||!ids.includes(source.id)||source.id===id)return;const next=ids.filter(v=>v!==source.id),after=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;next.splice(next.indexOf(id)+(after?1:0),0,source.id);ctx.parityDragSession=null;ctx.parityDragBusy=true;void Promise.resolve(onOrder(next,source.id,id)).catch(error=>ctx.io.notify(error.message)).finally(()=>{ctx.parityDragBusy=false;});}catch(error){ctx.io.notify(error.message);}});
    handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key)||event.isTrusted===false||ctx.io.isBusy?.())return;event.preventDefault();const next=[...ids],at=next.indexOf(id),to=at+(event.key==='ArrowUp'?-1:1);if(to<0||to>=next.length)return;[next[at],next[to]]=[next[to],next[at]];void Promise.resolve(onOrder(next)).catch(error=>ctx.io.notify(error.message));});return handle;
}
function studioImages(ctx,value,onChange,{optional=false}={}) {
    const {el,field}=ctx,wrap=el('div',null,{class:'pq-studio-images'});let current=value?{...value}:null;
    const enable=field('씬 이미지 설정 사용','input',{type:'checkbox'});if(optional){enable.input.checked=!!value;enable.input.addEventListener('change',()=>{current=enable.input.checked?{aspectRatio:ctx.getImages().aspectRatio,size:ctx.getImages().size}:null;onChange(current);render();});wrap.append(enable.wrap);}
    const grid=el('div',null,{class:'pq-studio-image-grid'});wrap.append(grid);
    function render(){grid.replaceChildren();grid.hidden=optional&&!current;if(grid.hidden)return;const effective={...ctx.getImages(),...current};
        for(const [key,label,items] of [['aspectRatio','이미지 비율',API_RATIOS.map(id=>({id,name:id,ratio:id}))],['size','이미지 크기',['1k','1.5k'].map(id=>({id,name:id}))],['mode','생성 모드',[['','모델 기본값'],['lite','Lite'],['standard','Standard'],['pro','Pro'],['ultra','Ultra']].map(([id,name])=>({id,name}))],['batchSize','생성당 이미지 수',[{id:1,name:'1장'},{id:4,name:'4장 배치'}]]]){
            const cell=el('div');if(optional&&['mode','batchSize'].includes(key)){const enabled=field(`씬 개별 ${label} 사용`,'input',{type:'checkbox'});enabled.input.checked=Object.hasOwn(current,key);enabled.input.addEventListener('change',()=>{if(enabled.input.checked)current[key]=effective[key];else delete current[key];onChange({...current});render();});cell.append(enabled.wrap);}
            cell.append(parityChoice(ctx,label,items,effective[key],id=>{current={...(current||effective),[key]:id};onChange({...current});render();}));grid.append(cell);
        }
    }render();return {wrap,set(value){current=value?{...value}:null;if(optional)enable.input.checked=!!current;render();}};
}
function mountSceneStudio(ctx) {
    const {el,action,field}=ctx,copy=v=>JSON.parse(JSON.stringify(v)),body=ctx.addPage('studio','씬·일괄 예약');
    let draft=null,baseline=null,checked=new Set(),selectedCopies=new Set(),selectedCard='',plan={id:'studio',name:'',rows:[],columns:[],count:1,exceptions:{},order:'byRow',imageOptions:ctx.getImages()},rowQuery='',sceneQuery='',openRows=new Set(['']),openScenes=new Set(['']),managedGroup='',uiWarning='',studioMode='materials';
    try {const saved=ctx.io.loadStudioDraft?.();if(saved){studioMode=['materials','editor','schedule'].includes(saved.mode)?saved.mode:'materials';plan=normalizeBatchPlan(saved.plan,saved.plan.id);selectedCard=typeof saved.selectedCard==='string'?saved.selectedCard:'';rowQuery=String(saved.rowQuery||'');sceneQuery=String(saved.sceneQuery||'');openRows=new Set(saved.openRows||['']);openScenes=new Set(saved.openScenes||['']);}}catch{ctx.io.notify('씬 구성 복원 실패 · 기존 저장값은 유지했습니다.');}
    const layout=el('div',null,{class:'pq-studio-layout'}),materials=el('div',null,{class:'pq-studio-materials'}),editor=el('div',null,{class:'pq-studio-editor'}),schedule=el('div',null,{class:'pq-studio-schedule'}),notice=el('div',null,{role:'status',class:'pq-studio-notice'});
    const searchRows=field('캐릭터·출연 검색','input',{type:'search'}),searchScenes=field('씬 검색','input',{type:'search'}),rowList=el('div',null,{class:'pq-studio-list','aria-label':'캐릭터·출연 선택'}),sceneList=el('div',null,{class:'pq-studio-list','aria-label':'씬 선택 목록'});
    searchRows.input.value=rowQuery;searchScenes.input.value=sceneQuery;
    const selectedRows=el('div',null,{class:'pq-studio-selected','aria-label':'선택 행 순서'}),selectedColumns=el('div',null,{class:'pq-studio-selected','aria-label':'선택 씬 순서'}),summary=el('strong',null,{role:'status','aria-label':'일괄 예약 수량'}),preview=el('div',null,{class:'pq-preview','aria-label':'일괄 조합 문구 미리보기'}),exceptions=el('details');exceptions.append(el('summary','조합별 반복 · 0회는 제외'));const table=el('div',null,{class:'pq-studio-matrix'});exceptions.append(table);
    const count=field('일괄 반복 수','input',{type:'number',min:'1',max:'100'}),batchName=field('묶음 이름','input',{placeholder:'비우면 자동 이름'}),order=el('div'),plans=el('div',null,{class:'pq-choice-list','aria-label':'저장한 일괄 구성'});count.input.value=String(plan.count);batchName.input.value=plan.name;
    const images=studioImages(ctx,plan.imageOptions,value=>updatePlan({...plan,imageOptions:value}));
    function persist(strict=false){try{ctx.io.saveStudioDraft?.({mode:studioMode,plan,selectedCard,rowQuery,sceneQuery,openRows:[...openRows],openScenes:[...openScenes]});uiWarning='';}catch(error){uiWarning='화면 구성 저장 실패 · 현재 화면만 유지: '+error.message;if(strict)throw error;notice.textContent=uiWarning;}}
    function updatePlan(next){const previous=plan;try{plan=normalizeBatchPlan(next,next.id||'studio');persist(true);}catch(error){plan=previous;notice.textContent=uiWarning;}renderSchedule();renderMaterials();}
    const dirty=()=>!!draft&&JSON.stringify(draft)!==JSON.stringify(baseline);
    async function save(){if(!draft)return;const live=ctx.getLibrary();if(baseline?.id&&JSON.stringify(live.sceneCards?.find(v=>v.id===baseline.id))!==JSON.stringify(baseline))throw Error('편집 중 씬이 변경·삭제됐습니다. 새 값 다시 읽기 또는 복제 저장을 사용하세요.');const card={...copy(draft),id:draft.id||crypto.randomUUID()};if(!card.name.trim())throw Error('씬 이름을 입력해 주세요.');const next=copy(live);next.sceneCards=next.sceneCards||[];const at=next.sceneCards.findIndex(v=>v.id===card.id);if(at<0)next.sceneCards.push(card);else next.sceneCards[at]=card;await ctx.commit(next,'씬 사본을 저장했습니다. 원본 청크·기존 예약은 유지됩니다.');selectedCard=card.id;baseline=copy(ctx.getLibrary().sceneCards.find(v=>v.id===card.id));draft=copy(baseline);persist();renderEditor();renderMaterials();}
    function discard(){const live=ctx.getLibrary().sceneCards?.find(v=>v.id===selectedCard);draft=live?copy(live):null;baseline=live?copy(live):null;renderEditor();}
    function editCard(card){ctx.confirmDraft(dirty(),save,discard,()=>{studioMode='editor';body.dataset.studioMode=studioMode;selectedCard=card?.id||'';draft=card?copy(card):{id:'',name:'',sceneIds:[],chunks:[],extra:{prompt:'',negativePrompt:''}};baseline=card?copy(card):copy(draft);persist();renderEditor();});}
    function rowItems(){const library=ctx.getLibrary();return [...library.characters.map(v=>({key:'character:'+v.id,name:v.name,kind:'character',id:v.id,folderId:v.folderId||'',text:v.prompt})),...(library.casts||[]).map(v=>({key:'cast:'+v.id,name:v.name,kind:'cast',id:v.id,folderId:library.characters.find(c=>c.id===v.characterId)?.folderId||'',text:v.extra?.prompt||'',searchText:(library.characters.find(c=>c.id===v.characterId)?.name||'')+' '+v.name+' '+(v.extra?.prompt||'')}))];}
    function grouped(list,parent,groups,opened,query,isRow){
        parent.replaceChildren();const library=ctx.getLibrary();
        for(const group of [{id:'',name:'미분류'},...groups]){
            const items=list.filter(v=>(v.folderId||'')===group.id&&(!query||(v.name+' '+(v.searchText||v.text||'')).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
            if(!items.length&&(!group.id||isRow))continue;
            const details=el('details',null,{class:'pq-folder-group'}),heading=el('summary');details.open=query?true:opened.has(group.id);heading.append(el('span',group.name+' · '+items.length+'개'));details.append(heading);
            if(!isRow&&group.id)heading.append(parityDrag(ctx,heading,group.id,groups.map(v=>v.id),async ids=>{const next=copy(ctx.getLibrary());next.sceneFolders=ids.map(id=>next.sceneFolders.find(v=>v.id===id));await ctx.commit(next,'씬 그룹 순서를 저장했습니다.');},'씬 그룹'));
            if(!isRow){heading.addEventListener('dragover',event=>{if(ctx.parityDragSession?.label==='씬 목록'){event.preventDefault();heading.dataset.dropActive='true';}});heading.addEventListener('drop',event=>{heading.dataset.dropActive='false';if(event.isTrusted===false||ctx.io.isBusy?.()||ctx.parityDragBusy||ctx.parityDragSession?.label!=='씬 목록')return;event.preventDefault();event.stopPropagation();const source=ctx.parityDragSession;ctx.parityDragSession=null;void ctx.commit(changeSceneCards(ctx.getLibrary(),[source.id],{folderId:group.id}),'씬을 그룹으로 이동했습니다.').catch(error=>ctx.io.notify(error.message));});}
            details.addEventListener('toggle',()=>{if(!query){if(details.open)opened.add(group.id);else opened.delete(group.id);persist();}});
            for(const item of items){
                const row=el('div',null,{class:'pq-parity-card','data-studio-scene':isRow?'':item.id}),choice=field((isRow?'일괄 행':'일괄 씬')+' 선택: '+item.name,'input',{type:'checkbox'});
                choice.input.checked=isRow?plan.rows.some(v=>batchRowKey(v)===item.key):plan.columns.includes(item.id);
                choice.input.addEventListener('change',()=>{const next=copy(plan);if(isRow)next.rows=choice.input.checked?[...next.rows,{kind:item.kind,id:item.id}]:next.rows.filter(v=>batchRowKey(v)!==item.key);else next.columns=choice.input.checked?[...next.columns,item.id]:next.columns.filter(v=>v!==item.id);updatePlan(next);});row.append(choice.wrap);
                if(!isRow){
                    row.append(parityDrag(ctx,row,item.id,(library.sceneCards||[]).map(v=>v.id),async(ids,moved)=>{const next=copy(ctx.getLibrary());next.sceneCards=ids.map(id=>next.sceneCards.find(v=>v.id===id));const card=next.sceneCards.find(v=>v.id===moved);if(group.id)card.folderId=group.id;else delete card.folderId;await ctx.commit(next,'씬 순서·그룹을 저장했습니다.');},'씬 목록'));
                    const check=field('씬 관리 선택: '+item.name,'input',{type:'checkbox'});check.input.checked=checked.has(item.id);check.input.addEventListener('change',()=>{if(check.input.checked)checked.add(item.id);else checked.delete(item.id);renderMaterials();});row.append(check.wrap,action(item.name,()=>editCard(ctx.getLibrary().sceneCards.find(v=>v.id===item.id))));
                    const thumb=ctx.getThumbnail(item.id);if(thumb)row.append(el('img',null,{src:thumb,alt:item.name+' 최근 성공 결과',class:'pq-scene-thumbnail'}));
                    if(item.imageOptions)row.append(ratioMark(el,item.imageOptions.aspectRatio),el('small',item.imageOptions.aspectRatio+' · '+ratioDescription(item.imageOptions.aspectRatio)));
                }
                row.append(previewMaterial(el,{prompt:item.text||'',negativePrompt:item.negativePrompt||''}));details.append(row);
            }
            parent.append(details);
        }
    }
    function renderMaterials(){const lib=ctx.getLibrary();grouped(rowItems(),rowList,lib.characterFolders||[],openRows,rowQuery,true);grouped((lib.sceneCards||[]).map(v=>({...v,text:v.chunks.map(c=>c.prompt).join(', ')+', '+(v.extra?.prompt||''),negativePrompt:v.extra?.negativePrompt||''})),sceneList,lib.sceneFolders||[],openScenes,sceneQuery,false);groupChoices.replaceChildren(parityChoice(ctx,'씬 이동 그룹',[{id:'',name:'미분류'},...(lib.sceneFolders||[])],managedGroup,value=>{managedGroup=value;renderMaterials();}));selectionStatus.textContent=`씬 관리 ${checked.size}개 선택 · 그룹 ${lib.sceneFolders?.find(v=>v.id===managedGroup)?.name||'미분류'}`;}
    async function moveCards(operation,newGroup){let next=copy(ctx.getLibrary()),folderId=managedGroup;if(newGroup){folderId=crypto.randomUUID();next.sceneFolders=[...(next.sceneFolders||[]),{id:folderId,name:newGroup}];}next=changeSceneCards(next,[...checked],{operation,folderId});await ctx.commit(next,'선택한 씬을 '+({move:'이동',duplicate:'복제',delete:'삭제'})[operation]+'했습니다. 등록된 작업·원본 이미지에는 영향이 없습니다.');if(newGroup)managedGroup=folderId;if(operation==='delete')checked.clear();renderMaterials();}
    const groupName=field('새 씬 그룹 이름'),groupChoices=el('div'),selectionStatus=el('small',null,{role:'status'}),management=el('details');management.append(el('summary','씬·그룹 관리'),selectionStatus,groupChoices,groupName.wrap,action('새 그룹 만들기',async()=>{if(!groupName.input.value.trim())throw Error('그룹 이름을 입력해 주세요.');const next=copy(ctx.getLibrary()),id=crypto.randomUUID();next.sceneFolders=[...(next.sceneFolders||[]),{id,name:groupName.input.value.trim()}];await ctx.commit(next,'씬 그룹을 만들었습니다.');managedGroup=id;renderMaterials();}),action('선택 씬 이동',()=>moveCards('move')),action('새 그룹으로 선택 이동',()=>{if(!groupName.input.value.trim())throw Error('새 그룹 이름을 입력해 주세요.');return moveCards('move',groupName.input.value.trim());}),action('선택 씬 복제',()=>moveCards('duplicate')),action('선택 씬 삭제',()=>ctx.confirm('선택한 씬 카드만 삭제합니다. 예약 사본과 원본 이미지는 유지합니다.',()=>moveCards('delete'))),action('그룹 이름 변경',async()=>{if(!managedGroup||!groupName.input.value.trim())throw Error('그룹과 새 이름을 입력해 주세요.');const next=copy(ctx.getLibrary());next.sceneFolders.find(v=>v.id===managedGroup).name=groupName.input.value.trim();await ctx.commit(next,'씬 그룹 이름을 바꿨습니다.');renderMaterials();}),action('선택 그룹 삭제',()=>ctx.confirm('그룹만 삭제하고 씬은 미분류로 옮깁니다.',async()=>{const next=copy(ctx.getLibrary());next.sceneFolders=next.sceneFolders.filter(v=>v.id!==managedGroup);for(const card of next.sceneCards||[])if(card.folderId===managedGroup)delete card.folderId;await ctx.commit(next,'씬 그룹을 삭제했습니다.');managedGroup='';renderMaterials();})));
    function renderEditor(){editor.replaceChildren(el('strong','씬 사본 편집'));if(!draft){editor.append(el('p','씬을 누르면 이 칸에서 청크 사본을 편집합니다.'));return;}const lib=ctx.getLibrary(),name=field('씬 이름'),extraPrompt=field('씬 추가 포지','textarea'),extraNegative=field('씬 추가 네거','textarea'),status=el('small',null,{role:'status'});name.input.value=draft.name;extraPrompt.input.value=draft.extra?.prompt||'';extraNegative.input.value=draft.extra?.negativePrompt||'';
        name.input.addEventListener('input',()=>{draft.name=name.input.value;status.textContent='저장 안 됨';});for(const [control,key] of [[extraPrompt.input,'prompt'],[extraNegative.input,'negativePrompt']])control.addEventListener('input',()=>{draft.extra={...(draft.extra||{prompt:'',negativePrompt:''}),[key]:control.value};status.textContent='저장 안 됨';});
        const sourceMissing=draft.sceneIds.filter(id=>!lib.scenes.some(v=>v.id===id));status.textContent=(dirty()?'저장 안 됨':'저장된 사본')+(sourceMissing.length?` · 원본 삭제 ${sourceMissing.length}개, 사본 유지`:'');editor.append(status,name.wrap,parityChoice(ctx,'씬 소속 그룹',[{id:'',name:'미분류'},...(lib.sceneFolders||[])],draft.folderId||'',value=>{if(value)draft.folderId=value;else delete draft.folderId;renderEditor();}),extraPrompt.wrap,extraNegative.wrap);
        const chunks=el('div',null,{class:'pq-studio-list','aria-label':'씬 청크 사본'});for(const item of draft.chunks){const row=el('div',null,{class:'pq-parity-card'}),positive=field(`씬 사본 포지: ${item.name}`,'textarea'),negative=field(`씬 사본 네거: ${item.name}`,'textarea');positive.input.value=item.prompt;negative.input.value=item.negativePrompt;const selection=field('씬 사본 관리 선택: '+item.name,'input',{type:'checkbox'});selection.input.checked=selectedCopies.has(item.id);selection.input.addEventListener('change',()=>{if(selection.input.checked)selectedCopies.add(item.id);else selectedCopies.delete(item.id);});row.append(selection.wrap);positive.input.addEventListener('input',()=>{item.prompt=positive.input.value;status.textContent='저장 안 됨';});negative.input.addEventListener('input',()=>{item.negativePrompt=negative.input.value;status.textContent='저장 안 됨';});row.append(parityDrag(ctx,row,item.id,draft.sceneIds,ids=>{draft.sceneIds=ids;draft.chunks=ids.map(id=>draft.chunks.find(v=>v.id===id));renderEditor();},'씬 사본'),el('strong',item.name),positive.wrap,negative.wrap,action('사본 제외',()=>{draft.sceneIds=draft.sceneIds.filter(id=>id!==item.id);draft.chunks=draft.chunks.filter(v=>v.id!==item.id);renderEditor();}));chunks.append(row);}editor.append(chunks,action('선택 사본 제외',()=>{draft.chunks=draft.chunks.filter(v=>!selectedCopies.has(v.id));draft.sceneIds=draft.chunks.map(v=>v.id);selectedCopies.clear();renderEditor();}),action('선택 사본 복제',()=>{draft.chunks=draft.chunks.flatMap(v=>selectedCopies.has(v.id)?[v,{...copy(v),id:crypto.randomUUID(),name:v.name+' (사본 복제)'}]:[v]);draft.sceneIds=draft.chunks.map(v=>v.id);selectedCopies.clear();renderEditor();}),action('씬 편집 새 값 다시 읽기',discard));
        const libraryChunks=el('details');libraryChunks.append(el('summary','청크 사본 추가'));for(const folder of [{id:'',name:'미분류'},...lib.chunkFolders]){const entries=lib.scenes.filter(v=>(v.folderId||'')===folder.id);if(!entries.length)continue;const details=el('details');details.open=!folder.id;details.append(el('summary',folder.name));for(const chunk of entries){const control=field(`씬에 청크 추가: ${chunk.name}`,'input',{type:'checkbox'});control.input.checked=draft.sceneIds.includes(chunk.id);control.input.addEventListener('change',()=>{if(control.input.checked&&!draft.sceneIds.includes(chunk.id)){draft.sceneIds.push(chunk.id);draft.chunks.push(stripFolder(chunk));}else if(!control.input.checked){draft.sceneIds=draft.sceneIds.filter(id=>id!==chunk.id);draft.chunks=draft.chunks.filter(v=>v.id!==chunk.id);}renderEditor();});details.append(control.wrap);}libraryChunks.append(details);}editor.append(libraryChunks);
        editor.append(studioImages(ctx,draft.imageOptions,value=>{if(value)draft.imageOptions=value;else delete draft.imageOptions;status.textContent='저장 안 됨';},{optional:true}).wrap);
        editor.append(parityChoice(ctx,'씬 트리거 위치',[{id:1,name:'공통문 뒤'},{id:2,name:'캐릭터 뒤'},{id:'end',name:'맨 끝'}],draft.triggerPosition??1,value=>{draft.triggerPosition=value;renderEditor();}),action('씬 저장',save),action('씬 복제 저장',async()=>{const next=copy(lib),card={...copy(draft),id:crypto.randomUUID(),name:(draft.name||'씬')+' (복사본)'};next.sceneCards=[...(next.sceneCards||[]),card];await ctx.commit(next,'새 씬으로 복제 저장했습니다.');selectedCard=card.id;baseline=copy(card);draft=copy(card);persist();renderEditor();}),action('최신 청크로 갱신',()=>{if(!selectedCard)throw Error('씬을 먼저 저장하세요.');const diff=refreshSceneCard(lib,selectedCard);ctx.confirm(`${diff.changes.length}개 변경 · 원본 삭제 ${diff.missing.length}개는 사본 유지\n`+diff.changes.map(v=>`${v.field}: ${v.before} → ${v.after}`).join('\n'),()=>{draft.chunks=copy(diff.card.chunks);renderEditor();});}));
    }
    function renderSchedule(){selectedRows.replaceChildren();selectedColumns.replaceChildren();const lib=ctx.getLibrary();
        for(const row of plan.rows){const key=batchRowKey(row),resolved=resolveBatchRow(lib,row),entry=el('div',null,{class:'pq-parity-card'});entry.append(parityDrag(ctx,entry,key,plan.rows.map(batchRowKey),ids=>updatePlan({...plan,rows:ids.map(id=>plan.rows.find(v=>batchRowKey(v)===id))}),'일괄 행'),el('strong',resolved.name),action('행 제외',()=>updatePlan({...plan,rows:plan.rows.filter(v=>batchRowKey(v)!==key)})));
            if(row.kind==='character')entry.append(parityChoice(ctx,`행 프리셋: ${resolved.name}`,lib.presets.map(v=>({id:v.id,name:v.name})),resolved.presetId,value=>updatePlan({...plan,rows:plan.rows.map(v=>batchRowKey(v)===key?{...v,presetId:value}:v)})));if(resolved.problems.length)entry.append(el('small',resolved.problems.join(' · ')));selectedRows.append(entry);}
        for(const id of plan.columns){const card=lib.sceneCards?.find(v=>v.id===id),entry=el('div',null,{class:'pq-parity-card'});entry.append(parityDrag(ctx,entry,id,plan.columns,ids=>updatePlan({...plan,columns:ids}),'일괄 씬'),el('strong',card?.name||'(삭제된 씬)'),action('열 제외',()=>updatePlan({...plan,columns:plan.columns.filter(v=>v!==id)})));selectedColumns.append(entry);}
        let expansion;try{expansion=expandBatchPlan(lib,plan,{defaultImageOptions:ctx.getImages()});summary.textContent=`${expansion.totals.pairs}조합 · ${expansion.totals.jobs}작업 · ${expansion.totals.images}장`;notice.textContent=[uiWarning,...expansion.problems.map(v=>v.message)].filter(Boolean).join('\n');if(expansion.reservations.length){const res=expansion.reservations[0],f=res.snapshot;preview.textContent=composePresetPrompts(f.common,f.character,f.chunks,f.preset,res.triggerPosition,f.extras).prompt;}else preview.textContent='캐릭터/출연과 씬을 고르세요.';}catch(error){notice.textContent=error.message;summary.textContent='구성을 확인해 주세요.';}
        table.replaceChildren();for(const row of plan.rows)for(const id of plan.columns){const key=batchCellKey(batchRowKey(row),id),label=`반복: ${resolveBatchRow(lib,row).name} × ${lib.sceneCards?.find(v=>v.id===id)?.name||id}`,input=field(label,'input',{type:'number',min:'0',max:'100'});input.input.value=String(plan.exceptions[key]??plan.count);input.input.addEventListener('change',()=>updatePlan({...plan,exceptions:{...plan.exceptions,[key]:Number(input.input.value)}}));table.append(input.wrap);}
        order.replaceChildren(parityChoice(ctx,'순회 순서',[{id:'byRow',name:'캐릭터별'},{id:'byColumn',name:'씬별'}],plan.order,value=>updatePlan({...plan,order:value})));plans.replaceChildren();for(const item of lib.batchPlans||[]){const button=action(item.name||item.id,()=>{plan=normalizeBatchPlan(item,item.id);count.input.value=String(plan.count);batchName.input.value=plan.name;images.set(plan.imageOptions);persist();renderSchedule();renderMaterials();});plans.append(button);}
    }
    async function reserve(register){const previous=copy(ctx.getLibrary()),expanded=expandBatchPlan(previous,plan,{defaultImageOptions:ctx.getImages()}),next=appendBatchReservations(previous,expanded);if(register)await ctx.enqueue({...next,reservations:expanded.reservations},{fresh:true});else await ctx.commit(next,`${expanded.totals.jobs}개 미등록 예약을 만들었습니다. 생성 요청은 보내지 않았습니다.`);renderSchedule();}
    count.input.addEventListener('change',()=>updatePlan({...plan,count:Number(count.input.value)}));batchName.input.addEventListener('input',()=>updatePlan({...plan,name:batchName.input.value}));searchRows.input.addEventListener('input',()=>{rowQuery=searchRows.input.value;persist();renderMaterials();});searchScenes.input.addEventListener('input',()=>{sceneQuery=searchScenes.input.value;persist();renderMaterials();});
    const castTools=el('details');castTools.append(el('summary','캐릭터 기본 프리셋·출연 관리'));const castEditor=mountCastTools(ctx,castTools,()=>{renderMaterials();renderSchedule();});const renderCast=()=>castEditor.refresh();
    materials.append(el('strong','캐릭터·출연 고르기'),searchRows.wrap,rowList,castTools,el('strong','씬 고르기'),action('새 씬 만들기',()=>editCard(null)),action('현재 조합으로 씬 만들기',async()=>{const recipe=ctx.getRecipe(),lib=ctx.getLibrary(),card={id:crypto.randomUUID(),name:recipe.sceneIds.map(id=>lib.scenes.find(v=>v.id===id)?.name).filter(Boolean).join(' · ')||'새 씬',sceneIds:[...recipe.sceneIds],chunks:recipe.sceneIds.map(id=>stripFolder(lib.scenes.find(v=>v.id===id))),imageOptions:recipe.imageOptions,triggerPosition:recipe.triggerPosition};const next=copy(lib);next.sceneCards=[...(next.sceneCards||[]),card];await ctx.commit(next,'현재 청크 조합을 씬 사본으로 저장했습니다.');editCard(card);}),searchScenes.wrap,sceneList,management);
    schedule.append(el('strong','예약 구성·순서'),selectedRows,selectedColumns,images.wrap,order,count.wrap,batchName.wrap,summary,notice,preview,exceptions,action('선택 조합 전부 예약',()=>reserve(false)),action('예약 후 바로 등록',()=>reserve(true)),action('구성 저장',async()=>{const next=copy(ctx.getLibrary()),saved=normalizeBatchPlan(plan,plan.id||crypto.randomUUID());saved.name=plan.name||defaultBatchName(plan.rows.length,plan.columns.length);next.batchPlans=next.batchPlans||[];const at=next.batchPlans.findIndex(v=>v.id===saved.id);if(at<0)next.batchPlans.push(saved);else next.batchPlans[at]=saved;await ctx.commit(next,'일괄 구성을 저장했습니다.');}),action('새 구성',()=>{plan={id:crypto.randomUUID(),name:'',rows:[],columns:[],count:1,exceptions:{},order:'byRow',imageOptions:ctx.getImages()};count.input.value='1';batchName.input.value='';images.set(plan.imageOptions);persist();renderSchedule();renderMaterials();}),el('strong','저장한 구성'),plans);
    ctx.resizable(layout,[materials,editor,schedule],'씬·일괄 예약',[.32,.34,.34],[240,260,250]);const mode=el('div',null,{class:'pq-studio-mode'});body.dataset.studioMode=studioMode;for(const [id,label] of [['materials','재료 선택'],['editor','씬 편집'],['schedule','구성·예약']])mode.append(action(label,()=>{studioMode=id;body.dataset.studioMode=id;persist();}));body.append(mode,layout);const restored=ctx.getLibrary().sceneCards?.find(v=>v.id===selectedCard);if(restored){draft=copy(restored);baseline=copy(restored);}renderMaterials();renderEditor();renderSchedule();renderCast();
    return {dirty,save,discard,castEditor,refresh(){const live=ctx.getLibrary().sceneCards?.find(v=>v.id===selectedCard);if(!dirty()){draft=live?copy(live):null;baseline=live?copy(live):null;renderEditor();}renderMaterials();renderSchedule();renderCast();}};
}
  // END PARITY UI
  // BEGIN PARITY CORE
// SPDX-License-Identifier: GPL-3.0-only
function jobBatch(job){return job.composition?.reservation?.batch||null;}
function filterQueueJobs(jobs,{view='active',state='',batch=''}={}){return jobs.filter(job=>queueHistory(job)===(view==='history')&&(!state||job.state===state)&&(!batch||(jobBatch(job)?.id||'ungrouped')===batch));}
function readGroupView(storage,key){try{const value=JSON.parse(storage.getItem(key)||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};return {view:['active','history'].includes(value.view)?value.view:'active',state:typeof value.state==='string'?value.state.slice(0,30):'',batch:typeof value.batch==='string'?value.batch.slice(0,200):'',opened:Array.isArray(value.opened)?value.opened.filter(v=>typeof v==='string'&&v.length<=200).slice(0,1000):[]};}catch{return {};}}
// Adapted 2026-10-13 from cotton100/PixaiClackHelper a23b9da, original project author sunanakgo.
// Browser port retains legacy validators; batch image options merge per field.
const hasOwn=(value,key)=>Object.hasOwn(value,key);
const MAX_RESERVED_JOBS=1000;
function allowedKeys(...args){return settingsBackupKeys(...args);}
function normalizeLibrary(value){return normalizePresetLibrary(value);}
function normalizeImageOptions(value){return normalizeReservationImageOptions(value);}
function normalizeSnapshot(value){return normalizeCombinationSnapshot(value);}
function createSceneThumbnailCache(io){
    let images=[];try{const raw=io.load();if(typeof raw==='string'&&raw.length<=2*1024*1024){const values=JSON.parse(raw);if(Array.isArray(values))images=values.filter(v=>typeof v.sceneId==='string'&&v.sceneId.length<=200&&typeof v.dataUrl==='string'&&v.dataUrl.length<=65536&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(v.dataUrl)&&Number.isFinite(v.savedAt)).slice(0,100);}}catch{}
    return {get:id=>images.find(v=>v.sceneId===id)?.dataUrl,clear(){try{io.save('[]');images=[];}catch{}},async remember(id,blob){if(!id||id.length>200)return false;try{const bitmap=await createImageBitmap(blob);if(bitmap.width*bitmap.height>40000000){bitmap.close();return false;}const scale=Math.min(1,256/bitmap.width,192/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const dataUrl=canvas.toDataURL('image/webp',.65);if(dataUrl.length>65536)return false;const next=[{sceneId:id,dataUrl,savedAt:Date.now()},...images.filter(v=>v.sceneId!==id)].slice(0,100);while(JSON.stringify(next).length>2*1024*1024)next.pop();io.save(JSON.stringify(next));images=next;return true;}catch{return false;}}};
}
function atomicRecordWrite(storage,writes,previousKey){
    const original=Object.fromEntries(Object.keys(writes).map(key=>[key,storage.getItem(key)]));
    if(previousKey)storage.setItem(previousKey,JSON.stringify(original));
    try{for(const [key,value] of Object.entries(writes))storage.setItem(key,value);}catch(error){let failed=false;for(const [key,value] of Object.entries(original))try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{failed=true;}throw Error(failed?'저장·원복 모두 실패했습니다. 이전 복구 사본을 보존했습니다.':'저장 실패 · 원래 자료로 되돌렸습니다.');}
}
function subsetRegisteredLibrary(current,value,{fresh=false}={}){const ids=new Set(value.reservations.map(v=>v.id));if(fresh){if(JSON.stringify({...current,reservations:[]})!==JSON.stringify({...value,reservations:[]}))throw Error('예약 재료가 다른 탭에서 변경됐습니다. 다시 확인해 주세요.');if(current.reservations.some(v=>ids.has(v.id)))throw Error('새 예약 ID가 중복됐습니다.');return current;}for(const reservation of value.reservations){const saved=current.reservations.find(v=>v.id===reservation.id);if(!saved||JSON.stringify(saved)!==JSON.stringify(reservation))throw Error('등록할 예약이 다른 탭에서 변경됐습니다. 다시 확인해 주세요.');}return {...current,reservations:current.reservations.filter(v=>!ids.has(v.id))};}
function changeSceneCards(value,ids,{operation='move',folderId='',idFactory=()=>crypto.randomUUID()}={}) {
    const library=normalizePresetLibrary(value),selected=new Set(ids);if(!ids.length||selected.size!==ids.length||ids.some(id=>!library.sceneCards?.some(v=>v.id===id)))throw Error('씬을 하나 이상 선택해 주세요.');
    if(operation==='move'&&folderId&&!library.sceneFolders?.some(v=>v.id===folderId))throw Error('이동할 씬 그룹이 없습니다.');
    const next=JSON.parse(JSON.stringify(library));
    if(operation==='delete')next.sceneCards=next.sceneCards.filter(v=>!selected.has(v.id));
    else if(operation==='duplicate'){const existing=new Set(next.sceneCards.map(v=>v.id));next.sceneCards=next.sceneCards.flatMap(v=>{if(!selected.has(v.id))return [v];const id=presetIdentifier(idFactory(),'복제 씬');if(existing.has(id))throw Error('복제 씬 ID가 중복됐습니다.');existing.add(id);return [v,{...v,id,name:v.name+' (복사본)'}];});}
    else if(operation==='move'){for(const scene of next.sceneCards)if(selected.has(scene.id)){if(folderId)scene.folderId=folderId;else delete scene.folderId;}}
    else throw Error('씬 관리 동작을 확인해 주세요.');
    return normalizePresetLibrary(next);
}
function convertImportedOptions(value) {
    const input={...presetObject(value,'대기열 옵션')},conversionWarnings=[];
    if(Object.hasOwn(input,'ui')) {normalizeWorkspaceUI(input.ui);delete input.ui;conversionWarnings.push('앱 전용 칸 비율·접힘·씬 보기 설정은 제외합니다. 이 브라우저의 화면 설정은 유지합니다.');}
    return {options:normalizeSettingsOptions(input),...(conversionWarnings.length?{conversionWarnings}:{})};
}
function compatibleSettings(library,options,meta,target='app') {
    const out=JSON.parse(JSON.stringify(settingsBackupLibrary(library))),preferences={...normalizeSettingsOptions(options)},warnings=[];
    if(Object.hasOwn(preferences,'embedMetadata')){delete preferences.embedMetadata;warnings.push('브라우저 PNG 기록 선택은 대상 앱/구형 스크립트 옵션에서 제외합니다.');}
    if(target==='legacy') {
        for(const key of ['commonPresets','sceneCards','sceneFolders','casts','batchPlans'])if(Object.hasOwn(out,key)){delete out[key];warnings.push(`${key}는 0.9.14에서 편집할 수 없어 제외합니다.`);}
        const cleanPreset=preset=>{const next={...preset};delete next.prompt;delete next.negativePrompt;delete next.commonPresetId;return next;};
        if(out.presets.some(item=>item.prompt||item.negativePrompt||item.commonPresetId))warnings.push('프리셋 문구·공통문 연결은 새 조합에서 제외합니다. 이미 예약한 문구는 사본에 합쳐 보존합니다.');
        out.reservations=out.reservations.map(res=>{
            const next={...res},frozen=res.snapshot || snapshotCombination(library,res),p=frozen.preset,join=(...parts)=>parts.map(presetText).filter(Boolean).join(', ');
            const chunks=frozen.chunks.map(item=>({...item})),extras=frozen.extras||{};
            if(extras.scene&&(extras.scene.prompt||extras.scene.negativePrompt))chunks.push({id:`${res.id}:scene-extra`,name:'씬 추가 문구',...extras.scene});
            next.sceneIds=chunks.map(item=>item.id);next.snapshot={common:{prompt:join(frozen.common.prompt,p.prompt),negativePrompt:join(frozen.common.negativePrompt,p.negativePrompt)},preset:cleanPreset(p),character:{...frozen.character,prompt:join(frozen.character.prompt,extras.cast?.prompt),negativePrompt:join(frozen.character.negativePrompt,extras.cast?.negativePrompt)},chunks};
            delete next.snapshot.character.defaultPresetId;delete next.snapshot.character.folderId;delete next.batch;delete next.sourceSceneId;return next;
        });
        out.presets=out.presets.map(cleanPreset);out.characters=out.characters.map(item=>{delete item.defaultPresetId;return item;});
    }
    return {backup:{format:'pixai-web-queue-settings',version:1,...settingsBackupMeta(meta),library:out,options:preferences},warnings};
}
/** Resolve only live compositions. Frozen reservations already contain the selected text. */
function resolvePresetCommon(library, preset) {
    if (!preset?.commonPresetId)
        return library.common;
    const selected = library.commonPresets?.find((item) => item.id === preset.commonPresetId);
    if (!selected)
        throw new Error('연결된 공통문 세트가 없습니다. 프리셋의 연결을 확인해 주세요.');
    return { prompt: selected.prompt, negativePrompt: selected.negativePrompt };
}
function deleteCommonPreset(library, id) {
    return {
        ...library,
        commonPresets: (library.commonPresets ?? []).filter((item) => item.id !== id),
        presets: library.presets.map((item) => item.commonPresetId === id ? omitKey(item, 'commonPresetId') : item)
    };
}
function normalizeExtraText(value, label) {
    const source = allowedKeys(value, label, [], ['prompt', 'negativePrompt']);
    return {
        prompt: presetText(source.prompt ?? ''),
        negativePrompt: presetText(source.negativePrompt ?? '')
    };
}
/** 청크에서 폴더 연결을 뺀 사본 (씬 카드·예약 사본용). */
function stripFolder(chunk) {
    return {
        id: chunk.id,
        name: chunk.name,
        prompt: chunk.prompt,
        negativePrompt: chunk.negativePrompt
    };
}
function omitKey(value, key) {
    const copy = { ...value };
    delete copy[key];
    return copy;
}
function normalizeSceneCard(item, id, folderIds) {
    if (!Array.isArray(item.sceneIds))
        throw new Error('씬의 청크 목록 형식을 확인해 주세요.');
    const sceneIds = item.sceneIds.map((value) => presetIdentifier(value, '씬 청크'));
    if (new Set(sceneIds).size !== sceneIds.length)
        throw new Error('씬에 같은 청크를 중복 넣을 수 없습니다.');
    if (!Array.isArray(item.chunks))
        throw new Error('씬의 청크 사본 형식을 확인해 주세요.');
    const chunks = normalizeChunkList(item.chunks, new Set(), '씬 청크 사본').map(stripFolder);
    if (JSON.stringify(chunks.map((chunk) => chunk.id)) !== JSON.stringify(sceneIds))
        throw new Error('씬 사본과 청크 순서가 다릅니다.');
    const card = { id, name: presetText(item.name), sceneIds, chunks };
    if (hasOwn(item, 'extra'))
        card.extra = normalizeExtraText(item.extra, '씬 추가 문구');
    if (hasOwn(item, 'imageOptions'))
        card.imageOptions = normalizeImageOptions(item.imageOptions);
    if (hasOwn(item, 'triggerPosition'))
        card.triggerPosition = normalizeTriggerPosition(item.triggerPosition, sceneIds.length);
    if (hasOwn(item, 'folderId')) {
        const folderId = presetIdentifier(item.folderId, '씬 모음');
        if (!folderIds.has(folderId))
            throw new Error(`씬 ${id}의 모음이 없습니다: ${folderId}`);
        card.folderId = folderId;
    }
    return card;
}
function normalizeCast(item, id) {
    const cast = {
        id,
        name: presetText(item.name),
        characterId: presetIdentifier(item.characterId, '출연 캐릭터'),
        presetId: presetIdentifier(item.presetId, '출연 프리셋')
    };
    if (hasOwn(item, 'extra'))
        cast.extra = normalizeExtraText(item.extra, '출연 추가 문구');
    if (hasOwn(item, 'triggerPosition'))
        cast.triggerPosition = normalizeTriggerPosition(item.triggerPosition, 1000);
    return cast;
}
const batchRowKey = (row) => `${row.kind}:${row.id}`;
const batchCellKey = (rowKey, columnId) => `${rowKey}|${columnId}`;
function normalizeBatchPlan(item, id = 'plan') {
    const source = allowedKeys(item, '일괄 예약 구성', ['rows', 'columns', 'count'], ['id', 'name', 'rows', 'columns', 'count', 'exceptions', 'order', 'imageOptions']);
    if (!Array.isArray(source.rows) || !Array.isArray(source.columns))
        throw new Error('일괄 예약의 행·열 목록 형식을 확인해 주세요.');
    const rows = source.rows.map((row) => {
        const entry = allowedKeys(row, '일괄 예약 행', ['kind', 'id'], ['kind', 'id', 'presetId']);
        if (entry.kind !== 'character' && entry.kind !== 'cast')
            throw new Error('일괄 예약 행 종류는 캐릭터 또는 출연이어야 합니다.');
        const result = { kind: entry.kind, id: presetIdentifier(entry.id, '일괄 예약 행') };
        if (hasOwn(entry, 'presetId') && presetText(entry.presetId))
            result.presetId = presetIdentifier(entry.presetId, '행 프리셋');
        return result;
    });
    if (new Set(rows.map(batchRowKey)).size !== rows.length)
        throw new Error('일괄 예약 행이 중복됐습니다.');
    const columns = source.columns.map((value) => presetIdentifier(value, '일괄 예약 씬'));
    if (new Set(columns).size !== columns.length)
        throw new Error('일괄 예약 씬이 중복됐습니다.');
    const plan = {
        id: presetIdentifier(id, '일괄 예약 구성'),
        name: presetText(source.name ?? ''),
        rows,
        columns,
        count: presetInteger(source.count, '일괄 반복 수', 1, 100),
        exceptions: {},
        order: 'byRow'
    };
    if (hasOwn(source, 'order') && source.order != null) {
        if (source.order !== 'byRow' && source.order !== 'byColumn')
            throw new Error('순회 순서는 캐릭터별 또는 씬별이어야 합니다.');
        plan.order = source.order;
    }
    if (hasOwn(source, 'exceptions') && source.exceptions != null) {
        const exceptions = presetObject(source.exceptions, '조합별 예외');
        const rowKeys = new Set(rows.map(batchRowKey));
        for (const [key, value] of Object.entries(exceptions)) {
            const split = key.indexOf('|');
            if (split < 0)
                throw new Error(`조합별 예외의 대상을 확인해 주세요: ${key}`);
            // 선택에서 빠진 행/열의 예외는 오류가 아니라 버린다 — 저장한 구성이 체크 해제에도 살아남게.
            if (!rowKeys.has(key.slice(0, split)) || !columns.includes(key.slice(split + 1)))
                continue;
            plan.exceptions[key] = presetInteger(value, '조합별 반복 수', 0, 100);
        }
    }
    if (hasOwn(source, 'imageOptions') && source.imageOptions != null)
        plan.imageOptions = normalizeImageOptions(source.imageOptions);
    return plan;
}
function normalizeBatchTag(value) {
    const source = allowedKeys(value, '예약 묶음', ['id', 'name'], ['id', 'name', 'rowName', 'columnName']);
    return {
        id: presetIdentifier(source.id, '예약 묶음'),
        name: presetText(source.name),
        rowName: presetText(source.rowName ?? ''),
        columnName: presetText(source.columnName ?? '')
    };
}
function normalizeChunkList(items, folderIds, label) {
    const seen = new Set();
    return items.map((raw) => {
        const item = presetObject(raw, label);
        const id = presetIdentifier(item.id, label);
        if (seen.has(id))
            throw new Error(`${label} ID가 중복됐습니다: ${id}`);
        seen.add(id);
        const chunk = {
            id,
            name: presetText(item.name),
            prompt: presetText(item.prompt),
            negativePrompt: presetText(item.negativePrompt)
        };
        if (hasOwn(item, 'folderId')) {
            const folderId = presetIdentifier(item.folderId, '청크 폴더');
            if (!folderIds.has(folderId))
                throw new Error(`청크 ${id}의 폴더가 없습니다: ${folderId}`);
            chunk.folderId = folderId;
        }
        return chunk;
    });
}
function normalizeWorkspaceUI(value) {
    const raw = allowedKeys(value, '화면 설정', [], ['paneRatios', 'collapsedPane', 'sceneView']);
    const result = {};
    if (raw.sceneView !== undefined) {
        if (!['grid', 'list'].includes(raw.sceneView))
            throw new Error('씬 보기 방식을 확인해 주세요.');
        result.sceneView = raw.sceneView;
    }
    if (raw.paneRatios !== undefined) {
        const ratios = allowedKeys(raw.paneRatios, '칸 비율', [], ['compose', 'scenes', 'library']);
        result.paneRatios = {};
        for (const name of ['compose', 'scenes', 'library'])
            if (ratios[name] !== undefined) {
                const values = ratios[name];
                if (!Array.isArray(values) ||
                    values.length !== 3 ||
                    values.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 5 || n > 90) ||
                    Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 0.1)
                    throw new Error('칸 비율을 확인해 주세요.');
                result.paneRatios[name] = [...values];
            }
    }
    if (raw.collapsedPane !== undefined) {
        const collapsed = allowedKeys(raw.collapsedPane, '접힌 칸', [], ['compose', 'scenes', 'library']);
        result.collapsedPane = {};
        for (const name of ['compose', 'scenes', 'library'])
            if (collapsed[name] !== undefined)
                result.collapsedPane[name] = presetInteger(collapsed[name], '접힌 칸', 0, 2);
    }
    return result;
}
/**
 * 여러 캐릭터(출연) × 여러 씬 일괄 예약.
 *
 * 행 = 캐릭터 또는 출연(A1, A2, A3, B1, B2 …), 열 = 씬(표정1, 표정2 …). 쌍마다 **별도 작업**으로 펼친다 —
 * 한 장에 여러 명을 넣는 단체 구성이 아니다. 결과는 보통의 예약(Reservation) 여러 개라 등록·확정·복구는 기존 흐름 그대로다.
 * 설계: docs/plans/2026-10-10_pixai-batch-reservation-design.md §2–§3.
 */
const defaultIdFactory = () => globalThis.crypto.randomUUID();
/** 라이브러리 청크로 씬 카드를 만든다. 이름이 비면 청크 이름을 ' · '로 잇는다. 캐릭터·프리셋은 절대 넣지 않는다. */
function makeSceneCard(value, input, options = {}) {
    const library = normalizeLibrary(value);
    const source = presetObject(input, '씬');
    if (!Array.isArray(source.sceneIds) || !source.sceneIds.length)
        throw new Error('씬에 넣을 청크를 하나 이상 골라 주세요.');
    const chunks = source.sceneIds.map((id) => {
        const found = library.scenes.find((item) => item.id === id);
        if (!found)
            throw new Error(`씬에 넣을 청크가 없습니다: ${id}`);
        return stripFolder(found);
    });
    const card = {
        id: source.id ?? (options.idFactory ?? defaultIdFactory)(),
        name: presetText(source.name ?? '') || chunks.map((item) => item.name || '청크').join(' · '),
        sceneIds: [...source.sceneIds],
        chunks
    };
    for (const key of ['extra', 'imageOptions', 'triggerPosition', 'folderId'])
        if (source[key] != null)
            card[key] = source[key];
    const sceneFolders = library.sceneFolders ?? [];
    const normalized = normalizeLibrary({ ...library, sceneFolders, sceneCards: [card] });
    return normalized.sceneCards[0];
}
/** 카드의 청크 사본과 현재 라이브러리를 비교만 한다. 카드는 바꾸지 않는다 — 사용자가 차이를 확인하면 돌려준 card로 교체. */
function refreshSceneCard(value, cardId) {
    const library = normalizeLibrary(value);
    const card = (library.sceneCards ?? []).find((item) => item.id === cardId);
    if (!card)
        throw new Error('갱신할 씬이 없습니다.');
    const changes = [];
    const missing = [];
    const chunks = card.chunks.map((copy) => {
        const live = library.scenes.find((item) => item.id === copy.id);
        if (!live) {
            missing.push(copy.id);
            return copy;
        }
        for (const field of ['name', 'prompt', 'negativePrompt'])
            if (live[field] !== copy[field])
                changes.push({ id: copy.id, field, before: copy[field], after: live[field] });
        return stripFolder(live);
    });
    return { card: { ...card, chunks }, changes, missing };
}
function defaultBatchName(rowCount, columnCount, now) {
    const at = new Date(now ?? Date.now());
    const pad = (value) => String(value).padStart(2, '0');
    return `캐릭터 ${rowCount} × 씬 ${columnCount} · ${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
/** 행 하나를 캐릭터+프리셋으로 해석한다. 프리셋 미지정·삭제된 재료는 problems로 알린다(임의 대체 없음). */
function resolveBatchRow(value, row) {
    const library = normalizeLibrary(value);
    const key = batchRowKey(row);
    const problems = [];
    let characterId = '';
    let presetId = '';
    let name = row.id;
    let extra;
    let triggerPosition;
    if (row.kind === 'cast') {
        const cast = (library.casts ?? []).find((item) => item.id === row.id);
        if (!cast)
            return {
                key,
                kind: 'cast',
                id: row.id,
                name,
                characterId,
                presetId,
                problems: [`출연 ${row.id}이(가) 없습니다.`]
            };
        ({ characterId, presetId, extra, triggerPosition } = cast);
        name = cast.name || cast.id;
    }
    else {
        const character = library.characters.find((item) => item.id === row.id);
        if (!character)
            return {
                key,
                kind: 'character',
                id: row.id,
                name,
                characterId,
                presetId,
                problems: [`캐릭터 ${row.id}이(가) 없습니다.`]
            };
        characterId = character.id;
        name = character.name || character.id;
        presetId = row.presetId || character.defaultPresetId || '';
        if (!presetId)
            problems.push(`캐릭터 「${name}」의 모델·LoRA 프리셋이 지정되지 않았습니다.`);
    }
    if (presetId && !library.presets.some((item) => item.id === presetId))
        problems.push(`「${name}」의 프리셋 ${presetId}이(가) 없습니다.`);
    if (characterId && !library.characters.some((item) => item.id === characterId))
        problems.push(`출연 「${name}」의 캐릭터 ${characterId}이(가) 없습니다.`);
    return {
        key,
        kind: row.kind,
        id: row.id,
        name,
        characterId,
        presetId,
        ...(extra ? { extra } : {}),
        ...(triggerPosition !== undefined ? { triggerPosition } : {}),
        problems
    };
}
/**
 * 행 × 열 × 반복 수를 예약으로 펼친다.
 * - 반복 수: 조합별 예외 > 공통값. 0 = 제외.
 * - 순회: byRow = 캐릭터별로 씬 순회, byColumn = 씬별로 캐릭터 순회. 순서는 수량을 바꾸지 않는다.
 * - 비율/크기: 씬 > 구성 > 없음(전역 설정). 트리거 위치: 씬 > 출연 > 기본.
 * - 오류(problems.level 'error')가 하나라도 있으면 reservations는 비어 있다. 경고(청크 연결 끊김)는 저장된 사본으로 진행한다.
 */
function expandBatchPlan(value, planInput, options = {}) {
    const library = normalizeLibrary(value);
    const plan = normalizeBatchPlan(planInput, planInput?.id ?? 'plan');
    const idFactory = options.idFactory ?? defaultIdFactory;
    const batchSize = options.batchSize == null || options.batchSize === 0
        ? 4
        : presetInteger(options.batchSize, '배치 장수', 1, 4);
    const problems = [];
    const rows = plan.rows.map((row) => resolveBatchRow(library, row));
    for (const row of rows)
        for (const message of row.problems)
            problems.push({ level: 'error', rowKey: row.key, rowName: row.name, message });
    const columns = plan.columns.map((id) => {
        const card = (library.sceneCards ?? []).find((item) => item.id === id);
        if (!card) {
            problems.push({
                level: 'error',
                columnId: id,
                columnName: id,
                message: `씬 ${id}이(가) 없습니다.`
            });
            return null;
        }
        const missing = card.sceneIds.filter((sceneId) => !library.scenes.some((item) => item.id === sceneId));
        if (missing.length)
            problems.push({
                level: 'warning',
                columnId: id,
                columnName: card.name,
                message: `씬 「${card.name}」의 청크 ${missing.join(', ')} 연결이 끊겨 저장된 사본을 사용합니다.`
            });
        return card;
    });
    const sequence = plan.order === 'byColumn'
        ? columns.flatMap((column) => rows.map((row) => [row, column]))
        : rows.flatMap((row) => columns.map((column) => [row, column]));
    const pairs = [];
    for (const [row, column] of sequence) {
        if (!column)
            continue;
        const key = batchCellKey(row.key, column.id);
        const count = Object.prototype.hasOwnProperty.call(plan.exceptions, key)
            ? plan.exceptions[key]
            : plan.count;
        if (count > 0)
            pairs.push({ row, column, count });
    }
    const batch = {
        id: options.batchId ?? idFactory(),
        name: plan.name || defaultBatchName(rows.length, columns.filter(Boolean).length, options.now)
    };
    const reservations = [];
    if (!problems.some((item) => item.level === 'error')) {
        for (const { row, column, count } of pairs) {
            const preset = library.presets.find((item) => item.id === row.presetId);
            const character = library.characters.find((item) => item.id === row.characterId);
            const extras = {};
            if (row.extra)
                extras.cast = row.extra;
            if (column.extra)
                extras.scene = column.extra;
            const triggerPosition = column.triggerPosition ?? row.triggerPosition;
            const imageOptions = { ...(options.defaultImageOptions ?? {}), ...(plan.imageOptions ?? {}), ...(column.imageOptions ?? {}) };
            const reservation = {
                id: presetIdentifier(idFactory(), '예약'),
                presetId: row.presetId,
                characterId: row.characterId,
                sceneIds: [...column.sceneIds],
                sourceSceneId: column.id,
                count,
                snapshot: normalizeSnapshot({
                    common: resolvePresetCommon(library, preset),
                    preset,
                    character,
                    chunks: column.chunks,
                    ...(Object.keys(extras).length ? { extras } : {})
                }),
                batch: { id: batch.id, name: batch.name, rowName: row.name, columnName: column.name }
            };
            if (triggerPosition !== undefined)
                reservation.triggerPosition =
                    triggerPosition === 'end'
                        ? 'end'
                        : Math.min(normalizeTriggerPosition(triggerPosition, 1000), column.sceneIds.length + 2);
            if (Object.keys(imageOptions).length)
                reservation.imageOptions = normalizeImageOptions(imageOptions);
            reservations.push(reservation);
        }
    }
    const jobs = pairs.reduce((sum, item) => sum + item.count, 0);
    return {
        batch,
        plan,
        reservations,
        problems,
        totals: { pairs: pairs.length, jobs, images: pairs.reduce((sum, item) => sum + item.count * (item.column.imageOptions?.batchSize ?? plan.imageOptions?.batchSize ?? options.defaultImageOptions?.batchSize ?? batchSize), 0), batchSize },
        order: pairs.map((item) => ({
            rowKey: item.row.key,
            rowName: item.row.name,
            columnId: item.column.id,
            columnName: item.column.name,
            count: item.count
        }))
    };
}
/** 전부 추가하거나(새 라이브러리 반환) 아무것도 바꾸지 않고 throw. 입력 라이브러리는 건드리지 않는다. */
function appendBatchReservations(value, expansion) {
    if (!expansion || !Array.isArray(expansion.reservations))
        throw new Error('일괄 예약 결과 형식을 확인해 주세요.');
    const errors = (expansion.problems ?? []).filter((item) => item.level === 'error');
    if (errors.length)
        throw new Error(`해결할 조합이 있습니다: ${errors.map((item) => item.message).join(' / ')}`);
    if (!expansion.reservations.length)
        throw new Error('예약할 조합이 없습니다. 반복 수와 제외 항목을 확인해 주세요.');
    const library = normalizeLibrary(value);
    const reserved = library.reservations.reduce((sum, item) => sum + item.count, 0);
    if (reserved + expansion.totals.jobs > MAX_RESERVED_JOBS)
        throw new Error(`예약 작업은 한 번에 ${MAX_RESERVED_JOBS.toLocaleString()}개까지 만들 수 있습니다.`);
    return normalizeLibrary({
        ...library,
        reservations: [...library.reservations, ...expansion.reservations]
    });
}
const IMAGE_INFO_MAX_BYTES = 32 * 1024 * 1024;
const IMAGE_INFO_TEXT_LIMIT = 1024 * 1024;
const IMAGE_INFO_KEY = 'pixai-clack-helper';
// Metadata is untrusted. Only explicit supported values become applicable settings.
function imageInfoFields(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    const p = value;
    const out = {};
    if(p.modelIncomplete===true||(Array.isArray(p.loras)&&p.loras.some(v=>!v||typeof v.versionId!=='string'||!/^\d{1,40}$/.test(v.versionId)||typeof v.id!=='string'||!/^\d{1,40}$/.test(v.id)))||(p.loras!==undefined&&(!Array.isArray(p.loras)||p.loras.length>5||p.loras.some(v=>!v||typeof v.weight!=='number'||!Number.isFinite(v.weight)||v.weight<0||v.weight>1))))out.modelIncomplete=true;
    for (const key of ['prompt', 'negativePrompt'])
        if (typeof p[key] === 'string' && p[key].length <= 100000)
            out[key] = p[key];
    if (typeof p.modelVersionId === 'string' && /^\d{1,40}$/.test(p.modelVersionId))
        out.modelVersionId = p.modelVersionId;
    if (typeof p.modelId === 'string' && /^\d{1,40}$/.test(p.modelId))
        out.modelId = p.modelId;
    if (Array.isArray(p.loras) &&
        p.loras.length <= 5 &&
        p.loras.every((v) => v &&
            typeof v.versionId === 'string' &&
            /^\d{1,40}$/.test(v.versionId) &&
            typeof v.weight === 'number' &&
            Number.isFinite(v.weight) &&
            v.weight >= 0 &&
            v.weight <= 1))
        out.loras = p.loras.map((v) => ({
            versionId: v.versionId,
            weight: v.weight,
            ...(typeof v.id === 'string' && /^\d{1,40}$/.test(v.id) ? { id: v.id } : {})
        }));
    if (Number.isInteger(p.seed) && Number(p.seed) >= 0 && Number(p.seed) <= 4294967295) {
        out.seed = Number(p.seed);
        out.seedKind = p.seedKind === 'request' ? 'request' : 'file';
    }
    if (p.batchSize === 1 || p.batchSize === 4)
        out.batchSize = p.batchSize;
    for (const key of ['width', 'height'])
        if (Number.isInteger(p[key]) && Number(p[key]) > 0 && Number(p[key]) <= 40000)
            out[key] = Number(p[key]);
    if (typeof p.aspectRatio === 'string' && API_RATIOS.includes(p.aspectRatio))
        out.aspectRatio = p.aspectRatio;
    if (p.size === '1k' || p.size === '1.5k')
        out.size = p.size;
    if (typeof p.mode === 'string' && ['', 'lite', 'standard', 'pro', 'ultra'].includes(p.mode))
        out.mode = p.mode;
    if (typeof p.style === 'string' && /^[a-z][a-z0-9-]{0,80}$/.test(p.style))
        out.style = p.style;
    return out;
}
/** Only the public model-page URL format documented by PixAI is accepted. */
function parsePublicModelLink(value) {
    let url;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new Error('PixAI 모델·LoRA 링크를 입력해 주세요.');
    }
    if (url.protocol !== 'https:' ||
        url.hostname !== 'pixai.art' ||
        url.port ||
        url.username ||
        url.password)
        throw new Error('https://pixai.art 모델 링크만 사용할 수 있습니다.');
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?model\/(\d{1,40})(?:-([^/]+))?(?:\/(\d{1,40}))?\/?$/);
    if (!match)
        throw new Error('PixAI 모델 페이지에서 사용할 버전을 선택한 뒤 링크를 복사해 주세요.');
    let name = '';
    try {
        name = decodeURIComponent(match[2] ?? '')
            .replace(/[-_]+/g, ' ')
            .slice(0, 200);
    }
    catch {
        /* optional name */
    }
    return {
        id: match[1],
        versionId: match[3] ?? '',
        name,
        url: `https://pixai.art/model/${match[1]}${match[3] ? `/${match[3]}` : ''}`,
        notice: match[3]
            ? '링크의 모델 ID와 버전 ID를 읽었습니다.'
            : '모델 ID만 있는 링크입니다. 사이트에서 버전을 선택한 링크를 넣거나 버전 ID를 직접 입력해 주세요.'
    };
}
  // END PARITY CORE
  // BEGIN BACKUP TRANSFER
// SPDX-License-Identifier: GPL-3.0-only
// Adapted 2026-10-16 from cotton100/PixaiClackHelper be258ad
// src/shared/pixai/backup-transfer.ts and expansion-budget.ts.
// Browser port uses existing strict validators, batch keys, and app-compatible v1 exports.
const BACKUP_CATEGORIES = [
    'sceneCards',
    'scenes',
    'characters',
    'presets',
    'commonPresets',
    'casts',
    'batchPlans',
    'reservations',
    'combinations'
];
const BACKUP_FOLDER_CATEGORIES = ['sceneCards', 'scenes'];
const BACKUP_LABELS = {
    sceneCards: '씬',
    scenes: '청크',
    characters: '캐릭터',
    presets: '모델·LoRA 프리셋',
    commonPresets: '공통문 세트',
    casts: '저장 출연',
    batchPlans: '일괄 예약 구성',
    reservations: '조합 예약',
    combinations: '최근 조합·즐겨찾기',
    common: '기본 공통문',
    options: '생성·화면 설정'
};
const TRANSFER_FOLDERS = {
    characters: 'characterFolders',
    scenes: 'chunkFolders',
    sceneCards: 'sceneFolders'
};
const TRANSFER_COLLECTIONS = [...BACKUP_CATEGORIES, ...Object.values(TRANSFER_FOLDERS)];
// The script accepts legacy library-only files too; a selective envelope always
// contains exactly one full settings backup, never another selective envelope.
function validateBackupSelection(value) {
    const keys = [...BACKUP_CATEGORIES, 'common', 'options'];
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== keys.length ||
        Object.keys(value).some((key) => !keys.includes(key)) ||
        Object.values(value).some((enabled) => typeof enabled !== 'boolean'))
        throw new Error('백업 선택 범위를 확인해 주세요.');
    return value;
}
/** Conservative allocation bound shared with the app's expansion budget. */
function backupJsonBytes(value, limit = 20 * 1024 * 1024) {
    let bytes = 0;
    const add = (count) => {
        bytes += count;
        if (bytes > limit)
            throw new Error('자료 용량이 너무 큽니다. 문구나 예약 수를 줄여 주세요.');
    };
    const visit = (item) => {
        if (typeof item === 'string') {
            if (item.length > limit) add(item.length);
            add(new TextEncoder().encode(JSON.stringify(item)).byteLength);
        } else if (Array.isArray(item)) {
            add(2 + item.length);
            for (const child of item) visit(child);
        } else if (item && typeof item === 'object') {
            add(2);
            for (const [key, child] of Object.entries(item)) {
                if (child === undefined) continue;
                visit(key);
                add(2);
                visit(child);
            }
        } else add(24);
    };
    visit(value);
    return bytes;
}
function backupFolderChoices(library, category) {
    return [...(library[TRANSFER_FOLDERS[category]] ?? []), { id: '', name: '미분류' }].map((folder) => ({
        ...folder,
        count: (library[category] ?? []).filter((item) => (item.folderId ?? '') === folder.id).length
    }));
}
function validateBackupFolderSelection(value, library) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
    const result = {};
    for (const key of Object.keys(value)) {
        if (!BACKUP_FOLDER_CATEGORIES.includes(key))
            throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
        const category = key;
        const ids = value[category];
        const allowed = new Set(backupFolderChoices(library, category).map((x) => x.id));
        if (!Array.isArray(ids) ||
            ids.some((id) => typeof id !== 'string' || !allowed.has(id)) ||
            new Set(ids).size !== ids.length)
            throw new Error('백업에 없는 폴더가 선택되어 있습니다. 폴더 선택을 다시 확인해 주세요.');
        result[category] = [...ids];
    }
    return result;
}
function isBackupSelectedItem(category, item, selection, folders) {
    const scope = folders[category];
    return selection[category] && (!scope || scope.includes(item.folderId ?? ''));
}
function backupSelectionLabels(library, selection, folders = {}) {
    return Object.keys(selection)
        .filter((key) => selection[key])
        .map((key) => {
        const scope = folders[key];
        if (!scope)
            return BACKUP_LABELS[key];
        const names = backupFolderChoices(library, key)
            .filter((folder) => scope.includes(folder.id))
            .map((folder) => `${folder.name} (${folder.count}개)`);
        return `${BACKUP_LABELS[key]}: ${names.join(', ') || '선택한 폴더 없음'}`;
    });
}
function backupSelection(enabled = true) {
    return Object.fromEntries([...BACKUP_CATEGORIES, 'common', 'options'].map((k) => [k, enabled]));
}
/** Dependencies are copied, not made replacement targets. Folder order survives. */
function selectBackupLibrary(value, selection, folderSelection = {}) {
    validateBackupSelection(selection);
    const source = settingsBackupLibrary(value);
    const folders = validateBackupFolderSelection(folderSelection, source);
    const ids = Object.fromEntries(TRANSFER_COLLECTIONS.map((k) => [k, new Set()]));
    const index = Object.fromEntries(TRANSFER_COLLECTIONS.map((k) => [k, new Map((source[k] ?? []).map((x) => [x.id, x]))]));
    const pending = [];
    const add = (key, id) => {
        if (!id || ids[key].has(id) || !index[key].has(id))
            return;
        ids[key].add(id);
        pending.push([key, id]);
    };
    for (const key of BACKUP_CATEGORIES) {
        if (!selection[key])
            continue;
        for (const item of source[key] ?? [])
            if (isBackupSelectedItem(key, item, selection, folders))
                add(key, item.id);
        const folderKey = TRANSFER_FOLDERS[key];
        const scope = folders[key];
        if (folderKey)
            for (const folder of source[folderKey] ?? [])
                if (!scope || scope.includes(folder.id))
                    add(folderKey, folder.id);
    }
    for (let cursor = 0; cursor < pending.length; cursor++) {
        const [key, id] = pending[cursor];
        if (key === 'presets')
            add('commonPresets', index.presets.get(id).commonPresetId);
        if (key === 'characters') {
            const item = index.characters.get(id);
            add('presets', item.defaultPresetId);
            add('characterFolders', item.folderId);
        }
        if (key === 'scenes')
            add('chunkFolders', index.scenes.get(id).folderId);
        if (key === 'sceneCards') {
            const item = index.sceneCards.get(id);
            add('sceneFolders', item.folderId);
            item.sceneIds.forEach((x) => add('scenes', x));
        }
        if (key === 'casts') {
            const item = index.casts.get(id);
            add('characters', item.characterId);
            add('presets', item.presetId);
        }
        if (key === 'batchPlans') {
            const item = index.batchPlans.get(id);
            item.rows.forEach((row) => {
                add(row.kind === 'cast' ? 'casts' : 'characters', row.id);
                add('presets', row.presetId);
            });
            item.columns.forEach((x) => add('sceneCards', x));
        }
        if (key === 'reservations' || key === 'combinations') {
            const item = index[key].get(id);
            add('characters', item.characterId);
            add('presets', item.presetId);
            item.sceneIds.forEach((x) => add('scenes', x));
            if ('sourceSceneId' in item)
                add('sceneCards', item.sourceSceneId);
        }
    }
    const library = makePresetLibrary();
    for (const key of TRANSFER_COLLECTIONS)
        Object.assign(library, { [key]: (source[key] ?? []).filter((x) => ids[key].has(x.id)) });
    // A preset without a linked set needs the source default, even when it is not
    // a replacement target. No key or path setting travels with these materials.
    if (selection.common || library.presets.some((x) => !x.commonPresetId) || selection.reservations)
        library.common = source.common;
    const dependencies = Object.fromEntries(BACKUP_CATEGORIES.map((key) => [
        key,
        (source[key] ?? []).filter((item) => ids[key].has(item.id) &&
            !isBackupSelectedItem(key, item, selection, folders)).length
    ]).filter(([, count]) => count));
    return { library: settingsBackupLibrary(library), dependencies };
}
function makeTransferBackup(library, options, selection, meta, folderSelection = {}) {
    validateBackupSelection(selection);
    if (!Object.values(selection).some(Boolean))
        throw new Error('백업할 항목을 하나 이상 선택해 주세요.');
    const folders = validateBackupFolderSelection(folderSelection, library);
    for (const category of BACKUP_FOLDER_CATEGORIES) {
        if (!selection[category])
            delete folders[category];
        else if (folders[category]?.length === 0)
            throw new Error(`${BACKUP_LABELS[category]}에서 폴더를 하나 이상 선택해 주세요.`);
    }
    const selected = selectBackupLibrary(library, selection, folders).library;
    const result = {
        format: 'pixai-clack-helper-selection',
        version: Object.keys(folders).length ? 2 : 1,
        selection: { ...selection },
        ...(Object.keys(folders).length ? { folderSelection: folders } : {}),
        backup: compatibleSettings(selected, selection.options ? options : { maxCredits: null, filePrefix: '', repeat: 1 }, meta, 'app').backup
    };
    backupJsonBytes(result, 5 * 1024 * 1024);
    return result;
}
function parseTransferBackup(text) {
    if (typeof text !== 'string')
        throw new Error('설정 파일 내용을 읽을 수 없습니다.');
    if (text.length > 5 * 1024 * 1024 || new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024)
        throw new Error('설정 파일은 5MiB 이하만 불러올 수 있습니다.');
    let parsed;
    try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, ''), (key, value) => {
            if (['__proto__', 'constructor', 'prototype'].includes(key))
                throw new Error('객체 속성');
            return value;
        });
    }
    catch {
        throw new Error('설정 파일의 JSON 형식 또는 허용하지 않는 객체 속성을 확인해 주세요.');
    }
    const value = parsed;
    if (value?.format !== 'pixai-clack-helper-selection')
        return {
            format: 'pixai-clack-helper-selection',
            version: 1,
            selection: backupSelection(),
            backup: parseSettingsBackup(text)
        };
    if ((value.version !== 1 && value.version !== 2) ||
        Object.keys(value).some((k) => ![
            'format',
            'version',
            'selection',
            'backup',
            ...(value.version === 2 ? ['folderSelection'] : [])
        ].includes(k)) ||
        (value.version === 2 && !value.folderSelection))
        throw new Error('지원하지 않는 선택 백업 형식입니다.');
    validateBackupSelection(value.selection);
    if (!value.backup || typeof value.backup !== 'object' || Array.isArray(value.backup) ||
        value.backup.format !== 'pixai-web-queue-settings' ||
        ![1, 2].includes(value.backup.version))
        throw new Error('선택 백업 안의 설정 백업 형식을 확인해 주세요.');
    const backup = parseSettingsBackup(JSON.stringify(value.backup));
    const folders = value.version === 2
        ? validateBackupFolderSelection(value.folderSelection, backup.library)
        : undefined;
    if (folders &&
        (Object.keys(folders).length === 0 ||
            BACKUP_FOLDER_CATEGORIES.some((key) => folders[key] && (!value.selection[key] || folders[key].length === 0))))
        throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
    return {
        format: value.format,
        version: value.version,
        selection: { ...value.selection },
        ...(folders ? { folderSelection: folders } : {}),
        backup
    };
}
/** Keep retained, not-yet-registered reservations unchanged when materials change. */
function freezeBackupReservation(library, reservation) {
    if (reservation.snapshot)
        return reservation;
    return {
        ...reservation,
        // The browser snapshot validator has no live folder collections.
        snapshot: snapshotCombination(library, reservation)
    };
}
function prepareBackupImport(current, transfer, selection, mode, idFactory = () => crypto.randomUUID(), folderSelection = transfer.folderSelection ?? {}) {
    validateBackupSelection(selection);
    if (mode !== 'append' && mode !== 'replace')
        throw new Error('추가 또는 선택 항목 교체 방식을 골라 주세요.');
    if (!Object.values(selection).some(Boolean))
        throw new Error('가져올 항목을 하나 이상 선택해 주세요.');
    const folders = validateBackupFolderSelection({ ...transfer.folderSelection, ...folderSelection }, transfer.backup.library);
    for (const key of BACKUP_FOLDER_CATEGORIES) {
        if (!selection[key])
            continue;
        const limit = transfer.folderSelection?.[key];
        if (folders[key]?.length === 0 ||
            (limit && folders[key]?.some((id) => !limit.includes(id))) ||
            (transfer.version === 2 && !transfer.selection[key]))
            throw new Error(`${BACKUP_LABELS[key]}의 백업에 포함된 폴더를 하나 이상 선택해 주세요.`);
    }
    const selected = selectBackupLibrary(transfer.backup.library, selection, folders);
    // Both values have passed JSON-only library validators. JSON copying also
    // supports userscript sandboxes without the structuredClone global.
    const incoming = JSON.parse(JSON.stringify(selected.library));
    const result = JSON.parse(JSON.stringify(settingsBackupLibrary(current)));
    const warnings = [];
    // Folder collections follow their material category, including empty folders.
    const replace = (key, item) => {
        if (mode !== 'replace')
            return false;
        const category = Object.entries(TRANSFER_FOLDERS).find(([, folder]) => folder === key)?.[0];
        if (category) {
            const scope = folders[category];
            return selection[category] && (!scope || scope.includes(item.id));
        }
        return isBackupSelectedItem(key, item, selection, folders);
    };
    if (mode === 'replace' &&
        !selection.reservations &&
        ['common', 'presets', 'characters', 'scenes', 'commonPresets'].some((k) => selection[k]))
        result.reservations = result.reservations.map((x) => freezeBackupReservation(result, x));
    const retained = Object.fromEntries(TRANSFER_COLLECTIONS.map((key) => [key, (result[key] ?? []).filter((item) => !replace(key, item))]));
    const maps = Object.fromEntries([...TRANSFER_COLLECTIONS, 'batch'].map((k) => [k, new Map()]));
    const used = new Set([
        ...TRANSFER_COLLECTIONS.flatMap((k) => [...(result[k] ?? []), ...(incoming[k] ?? [])].map((x) => x.id)),
        ...result.reservations.flatMap((x) => (x.batch ? [x.batch.id] : []))
    ]);
    const fresh = () => {
        for (let attempt = 0; attempt < 100; attempt++) {
            const id = idFactory();
            if (id && !used.has(id)) {
                used.add(id);
                return id;
            }
        }
        throw new Error('가져올 자료의 새 ID를 만들지 못했습니다.');
    };
    const remap = (key, id) => {
        if (!maps[key].has(id)) {
            const item = key === 'batch' ? undefined : (selected.library[key] ?? []).find((x) => x.id === id);
            const keep = key !== 'batch' && item && replace(key, item) && !retained[key].some((x) => x.id === id);
            maps[key].set(id, keep ? id : fresh());
        }
        return maps[key].get(id);
    };
    for (const key of TRANSFER_COLLECTIONS)
        for (const item of incoming[key] ?? [])
            item.id = remap(key, item.id);
    // Append never changes the user's default common text. Preserve imported
    // unlinked presets by assigning their old default to a new named set.
    const replacingDefault = mode === 'replace' && selection.common;
    const defaultDiffers = JSON.stringify(incoming.common) !== JSON.stringify(result.common);
    let importedDefault = [];
    if (!replacingDefault &&
        ((selection.common && mode === 'append') ||
            (defaultDiffers && incoming.presets.some((x) => !x.commonPresetId)))) {
        const id = fresh();
        importedDefault = [{ id, name: '가져온 기본 공통문', ...incoming.common }];
        for (const preset of incoming.presets)
            if (!preset.commonPresetId)
                preset.commonPresetId = id;
        // Mark this local ID as already remapped.
        maps.commonPresets.set(id, id);
        warnings.push('가져온 기본 공통문은 새 공통문 세트로 보관하고, 필요한 프리셋에 연결합니다.');
    }
    if (replacingDefault)
        result.common = incoming.common;
    const presetRef = (p) => {
        if (p.commonPresetId)
            p.commonPresetId = remap('commonPresets', p.commonPresetId);
    };
    for (const preset of incoming.presets)
        presetRef(preset);
    for (const character of incoming.characters) {
        if (character.defaultPresetId)
            character.defaultPresetId = remap('presets', character.defaultPresetId);
        if (character.folderId)
            character.folderId = remap('characterFolders', character.folderId);
    }
    for (const chunk of incoming.scenes)
        if (chunk.folderId)
            chunk.folderId = remap('chunkFolders', chunk.folderId);
    for (const card of incoming.sceneCards ?? []) {
        if (card.folderId)
            card.folderId = remap('sceneFolders', card.folderId);
        card.sceneIds = card.sceneIds.map((id) => remap('scenes', id));
        for (const chunk of card.chunks)
            chunk.id = remap('scenes', chunk.id);
    }
    for (const cast of incoming.casts ?? []) {
        cast.characterId = remap('characters', cast.characterId);
        cast.presetId = remap('presets', cast.presetId);
    }
    for (const plan of incoming.batchPlans ?? []) {
        const rows = new Map(plan.rows.map((row) => {
            const before = batchRowKey(row);
            row.id = remap(row.kind === 'cast' ? 'casts' : 'characters', row.id);
            if (row.presetId)
                row.presetId = remap('presets', row.presetId);
            return [before, batchRowKey(row)];
        }));
        const exceptions = {};
        for (const [cell, count] of Object.entries(plan.exceptions)) {
            const separator = cell.indexOf('|');
            const row = rows.get(cell.slice(0, separator));
            if (row)
                exceptions[batchCellKey(row, remap('sceneCards', cell.slice(separator + 1)))] = count;
        }
        plan.exceptions = exceptions;
        plan.columns = plan.columns.map((id) => remap('sceneCards', id));
    }
    for (const item of [...incoming.reservations, ...(incoming.combinations ?? [])]) {
        item.presetId = remap('presets', item.presetId);
        item.characterId = remap('characters', item.characterId);
        item.sceneIds = item.sceneIds.map((id) => remap('scenes', id));
        if ('snapshot' in item && item.snapshot) {
            item.snapshot.preset.id = item.presetId;
            // Frozen common is authoritative; a deleted live set must not bind elsewhere.
            delete item.snapshot.preset.commonPresetId;
            item.snapshot.character.id = item.characterId;
            if (item.snapshot.character.defaultPresetId)
                item.snapshot.character.defaultPresetId = remap('presets', item.snapshot.character.defaultPresetId);
            for (const chunk of item.snapshot.chunks)
                chunk.id = remap('scenes', chunk.id);
        }
        if ('sourceSceneId' in item && item.sourceSceneId)
            item.sourceSceneId = remap('sceneCards', item.sourceSceneId);
        if ('batch' in item && item.batch)
            item.batch.id = remap('batch', item.batch.id);
    }
    for (const key of TRANSFER_COLLECTIONS) {
        const merged = [...retained[key], ...(incoming[key] ?? [])];
        const category = Object.entries(TRANSFER_FOLDERS).find(([, folder]) => folder === key)?.[0];
        if (mode === 'replace' && category && folders[category]) {
            // Replacing a folder's contents must not move that folder to the end.
            const byId = new Map(merged.map((item) => [item.id, item]));
            result[key] = [...(result[key] ?? []), ...merged].flatMap((item) => {
                const kept = byId.get(item.id);
                byId.delete(item.id);
                return kept ? [kept] : [];
            });
        } else result[key] = merged;
    }
    result.commonPresets = [...(result.commonPresets ?? []), ...importedDefault];
    // A removed linked set cannot silently switch existing presets to the default.
    if (result.presets.some((p) => p.commonPresetId && !result.commonPresets?.some((x) => x.id === p.commonPresetId)))
        throw new Error('남겨 둔 프리셋이 사용하는 공통문 세트가 교체로 없어집니다. 추가 방식으로 가져오거나 프리셋도 함께 선택해 주세요.');
    const broken = result.characters.filter((x) => x.defaultPresetId && !result.presets.some((p) => p.id === x.defaultPresetId)).length +
        (result.casts ?? []).filter((x) => !result.characters.some((c) => c.id === x.characterId) ||
            !result.presets.some((p) => p.id === x.presetId)).length;
    if (broken)
        warnings.push(`교체 후 캐릭터·출연 ${broken}개의 연결 재료가 없습니다. 사용 전에 프리셋·캐릭터를 다시 지정해 주세요.`);
    if (mode === 'replace' && selection.scenes && (result.sceneCards?.length ?? 0))
        warnings.push('기존 씬은 저장된 청크 사본을 유지합니다. 바뀐 청크를 씬에 반영하려면 씬에서 갱신해 주세요.');
    // normalizeLibrary trims recent history; do not silently discard imports.
    const history = result.combinations ?? [];
    if (history.filter((x) => !x.favorite).length > 50 ||
        history.filter((x) => x.favorite).length > 1000)
        throw new Error('최근 조합은 50개, 즐겨찾기는 1,000개까지입니다. 기존 기록을 정리하거나 이 항목을 빼 주세요.');
    backupJsonBytes(result);
    return {
        library: settingsBackupLibrary(result),
        ...(selection.options && transfer.backup.options ? { options: transfer.backup.options } : {}),
        dependencies: selected.dependencies,
        warnings
    };
}
  // END BACKUP TRANSFER
  const normalize = text => String(text ?? '').replace(/\r\n/g, '\n').trim();
  function readPromptEditorText(input) {
    const nodes=Array.from(input.childNodes || []);
    if (!nodes.length) return String(input.innerText ?? input.textContent ?? '');
    function inline(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
      if (node.tagName === 'BR') return node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n';
      if (!['SPAN','STRONG','EM','B','I','U','S','CODE','A'].includes(node.tagName)) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
      return Array.from(node.childNodes).map(inline).join('');
    }
    if (nodes.every(node=>node.nodeType === 3)) return nodes.map(inline).join('');
    if (!nodes.every(node=>node.nodeType === 1 && node.tagName === 'P')) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
    // innerText adds visual blank lines between paragraphs. Tiptap stores one
    // logical newline per paragraph boundary; preserve explicit empty paragraphs.
    return nodes.map(p=>Array.from(p.childNodes).map(inline).join('')).join('\n');
  }
  const jsonObject = value => typeof value === 'string' ? JSON.parse(value) : (value ?? {});
  const safeName = name => String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 65) || 'PixAI';
  const resumable = new Set(['queued', 'waiting', 'saving', 'save_failed']);
  function checkCost(text, limit) {
    if (limit == null) return null;
    const match = String(text).match(/(?:생성!|Generate)\s*([\d,]+)(?=\s*(?:Ctrl\+|$))/i);
    const cost = match ? Number(match[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(cost) || cost < 1) throw new Error('생성 비용을 확정할 수 없습니다.');
    if (cost > limit) throw new Error(`표시 비용 ${cost.toLocaleString()}크레딧이 설정 상한 ${limit.toLocaleString()}을 넘습니다.`);
    return cost;
  }

  // Google Material Icons, Apache-2.0. See MATERIAL-ICONS-LICENSE.txt and THIRD_PARTY_NOTICES.md.
  const materialPaths = {"folder":["M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"],"folder_open":["M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"],"create_new_folder":["M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"],"content_copy":["M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"],"delete":["M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"],"add":["M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"],"close":["M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"],"drag_indicator":["M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"],"play_arrow":["M8 5v14l11-7z"],"stop":["M6 6h12v12H6z"],"settings":["M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"],"person":["M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"],"layers":["M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"],"view_module":["M14.67,5v6.5H9.33V5H14.67z M15.67,11.5H21V5h-5.33V11.5z M14.67,19v-6.5H9.33V19H14.67z M15.67,12.5V19H21v-6.5H15.67z M8.33,12.5H3V19h5.33V12.5z M8.33,11.5V5H3v6.5H8.33z"],"playlist_add":["M14,10H3v2h11V10z M14,6H3v2h11V6z M18,14v-4h-2v4h-4v2h4v4h2v-4h4v-2H18z M3,16h7v-2H3V16z"],"tune":["M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"],"save":["M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"],"search":["M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"],"chevron_left":["M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],"chevron_right":["M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"],"open_in_full":["M21,11 L21,3 L13,3 L16.29,6.29 L6.29,16.29 L3,13 L3,21 L11,21 L7.71,17.71 L17.71,7.71 Z"],"download":["M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z"],"upload":["M5,20h14v-2H5V20z M5,10h4v6h6v-6h4l-7-7L5,10z"]};
  function materialIcon(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'currentColor','aria-hidden':'true',focusable:'false',class:'pq-icon'})) svg.setAttribute(key,value);
    for (const d of materialPaths[name] || materialPaths.layers) {const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}
    return svg;
  }
  function decorateIcon(control,name) {if (!control.querySelector('svg.pq-icon')) {control.dataset.icon=name;control.append(materialIcon(name));}return control;}
  function clampPosition(position, size, viewport) {
    const margin = 8;
    const maxX = Math.max(margin, viewport.width - size.width - margin);
    const maxY = Math.max(margin, viewport.height - size.height - margin);
    return {
      x:Math.min(maxX, Math.max(margin, Number.isFinite(position?.x) ? position.x : margin)),
      y:Math.min(maxY, Math.max(margin, Number.isFinite(position?.y) ? position.y : margin))
    };
  }
  function bindPanelDrag(target, handle, io) {
    let drag = null;
    let positioned = false;
    function place(position) {
      const rect = target.getBoundingClientRect();
      const next = clampPosition(position, rect, io.viewport());
      Object.assign(target.style, {left:`${next.x}px`, top:`${next.y}px`, right:'auto', bottom:'auto'});
      positioned = true;
      return next;
    }
    function remember() {
      try { io.save({x:parseFloat(target.style.left), y:parseFloat(target.style.top)}); }
      catch { /* Moving still works when position storage is unavailable. */ }
    }
    try {
      const saved = io.load();
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) place(saved);
    } catch { /* Ignore a malformed position record, never the generation queue. */ }
    function bindHandle(control, open) {
      const tappable = typeof open === 'function';
      function move(event) {
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
        drag.moved = true;
        control.dataset.dragging = '';
        place({x:event.clientX - drag.x, y:event.clientY - drag.y});
      }
      control.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.isPrimary === false || drag || control.disabled || (tappable && event.isTrusted === false)) return;
        const rect = target.getBoundingClientRect();
        drag = {id:event.pointerId, control, x:event.clientX - rect.left, y:event.clientY - rect.top,
          startX:event.clientX, startY:event.clientY, moved:!tappable};
        if (!tappable) {place({x:rect.left,y:rect.top}); control.dataset.dragging = '';}
        control.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopPropagation();
      });
      control.addEventListener('pointermove', event => {
        if (!drag || drag.control !== control || event.pointerId !== drag.id) return;
        move(event);
        event.preventDefault(); event.stopPropagation();
      });
      const finish = event => {
        if (!drag || drag.control !== control || event.pointerId !== drag.id) return;
        if (tappable && !drag.moved && event.type === 'pointerup') move(event);
        const moved = drag.moved;
        drag = null;
        delete control.dataset.dragging;
        if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
        if (moved) remember();
        if (tappable) {
          event.preventDefault(); event.stopPropagation();
          if (!moved && event.type === 'pointerup' && event.isTrusted !== false && !control.disabled) open();
        }
      };
      for (const type of ['pointerup','pointercancel','lostpointercapture']) control.addEventListener(type, finish);
      if (tappable) control.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        // Pointer taps are handled on release; keyboard/assistive clicks have no pointer detail.
        if (event.detail === 0 && !event.pointerType && event.isTrusted !== false && !control.disabled && !drag) open();
      });
    }
    bindHandle(handle);
    if (io.launcher) bindHandle(io.launcher, io.open);
    io.onResize(() => {
      if (!positioned) return;
      const rect = target.getBoundingClientRect();
      place({x:rect.left,y:rect.top}); remember();
    });
    // After the panel changed size (fold/unfold), keep its top-right corner where it was: the launcher
    // appears under the collapse button and the panel grows back to the left instead of jumping.
    function keepRight(before) {
      if (!before || !(before.width > 0)) return;
      const after = target.getBoundingClientRect();
      if (!(after.width > 0) || after.width === before.width) return;
      place({x:before.left + before.width - after.width, y:before.top}); remember();
    }
    return {keepRight};
  }
  async function acceptFolder(chosen, io) {
    if (await chosen.queryPermission({mode:'readwrite'}) !== 'granted') throw new Error('선택한 폴더의 쓰기 권한이 없습니다. 폴더를 다시 선택하고 허용해 주세요.');
    if (io.partial && (!io.previous || !await chosen.isSameEntry(io.previous))) {
      throw new Error('부분 저장 작업은 기존 저장 폴더를 확인해야 재개할 수 있습니다.');
    }
    try { await io.remember(); return ''; }
    catch (error) {
      return `폴더 선택 완료. 다음 접속용 기록에 실패해 이 탭에서만 사용합니다 (${error.name || 'Error'}). 부분 저장 중 새로고침하지 마세요.`;
    }
  }
  function folderError(error) {
    if (error.name === 'AbortError') return '폴더 선택이 취소됐거나 브라우저에서 선택을 허용하지 않았습니다. 에셋 전용 하위 폴더를 선택해 주세요.';
    if (error.name === 'SecurityError') return `폴더 선택이 브라우저에서 차단됐습니다. PixAI 탭에서 버튼을 직접 눌러 주세요. [SecurityError] ${error.message}`;
    return `[${error.name || 'Error'}] ${error.message}`;
  }
  function storageSupport(win, download, info) {
    if (typeof win.showDirectoryPicker === 'function') return {mode:'folder', supported:true, message:'폴더 직접 저장 · 저장 폴더를 선택해 주세요.'};
    const supported = typeof download === 'function' && info?.downloadMode === 'browser';
    return {mode:'download', supported, message:supported
      ? '자동 다운로드 · 저장 위치는 브라우저의 다운로드 설정을 따릅니다. 준비 확인으로 작은 JSON 파일을 먼저 저장해 주세요.'
      : '자동 다운로드 준비 필요 · Tampermonkey 최신판에서 다운로드 모드를 Browser API로 설정하고 다운로드 권한을 허용한 뒤 새로고침해 주세요. 저장 폴더는 Firefox 다운로드 설정에서 정합니다.'};
  }
  function downloadError(error) {
    const code = error?.error || error?.name || 'download_failed';
    const advice = {
      not_enabled:'Tampermonkey 다운로드 기능을 켜 주세요.',
      not_whitelisted:'Tampermonkey의 허용 다운로드 확장자에 png, jpg, webp, json을 추가해 주세요.',
      not_permitted:'Tampermonkey 다운로드 권한을 허용해 주세요.',
      not_supported:'Tampermonkey를 최신판으로 업데이트하고 다운로드 모드를 Browser API로 설정해 주세요.',
      timeout:'다운로드 완료 확인 시간이 지났습니다. 이미 저장된 파일이 있을 수 있습니다. 재개하면 같은 작업의 파일을 추가 사본으로 저장합니다.'
    };
    return new Error(`다운로드 실패 [${code}]. ${advice[code] || '최신 Tampermonkey인지 확인하고 다운로드 목록과 설정을 확인해 주세요. 취소되거나 완료를 확인하지 못한 파일은 성공으로 처리하지 않습니다.'}`);
  }
  function managedDownload(download, blob, name, timers = {set:(fn,ms)=>setTimeout(fn,ms), clear:id=>clearTimeout(id)}) {
    return new Promise((resolve,reject) => {
      let settled = false, control;
      const timer = timers.set(() => {
        fail({error:'timeout'});
        try { control?.abort(); } catch {}
      }, 120000);
      function finish(action, value) {
        if (settled) return;
        settled = true; timers.clear(timer); action(value);
      }
      function fail(error) { finish(reject, downloadError(error)); }
      try {
        control = download({url:blob, name, saveAs:false, conflictAction:'uniquify',
          onload:() => finish(resolve,name), onerror:fail, ontimeout:() => fail({error:'timeout'})});
      } catch (error) { fail(error); }
    });
  }
  function resetDownloadProgress(jobs) {
    // A browser download destination cannot be identified after reload/settings changes.
    // Save a complete new set for a known task; preserve all prior progress and files.
    for (const job of jobs) {
      if (!resumable.has(job.state) || !job.saved?.length) continue;
      if (!job.taskId) throw new Error('부분 다운로드 작업 ID가 없어 자동 재개할 수 없습니다.');
      job.previousDownloads ??= [];
      job.previousDownloads.push({files:job.saved, metadataFile:job.metadataFile || null, at:new Date().toISOString()});
      job.saved = []; delete job.metadataFile;
    }
  }
  // Direct pointer handlers also support browsers where only click delivery fails.
  function bindFolderActivation(root, getButton, action, onError) {
    let lastPointerAt = -Infinity;
    let pressedPointer = null;
    root.addEventListener('pointerdown', event => {
      const element = getButton();
      pressedPointer = element && !element.disabled && element.contains(event.target) && event.button === 0 && event.isPrimary !== false
        ? event.pointerId : null;
    }, true);
    root.addEventListener('pointercancel', () => { pressedPointer = null; }, true);
    const activate = event => {
      const element = getButton();
      if (!element || !element.contains(event.target)) return;
      if (event.type === 'pointerup') {
        const pressed = pressedPointer;
        pressedPointer = null;
        if (event.button !== 0 || event.isPrimary === false || event.pointerId !== pressed) return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      if (element.disabled) return;
      if (event.isTrusted === false) { onError(new Error('폴더 버튼을 마우스 또는 키보드로 직접 눌러 주세요.')); return; }
      if (event.type === 'pointerup') {
        lastPointerAt = event.timeStamp;
      } else if (event.detail > 0 && event.timeStamp - lastPointerAt < 1000) return;
      try { Promise.resolve(action()).catch(onError); }
      catch (error) { onError(error); }
    };
    root.addEventListener('pointerup', activate, true);
    root.addEventListener('click', activate, true); // Keyboard/assistive activation also works.
  }
  async function pickDirectory(win, notify, timers = {set:(fn,ms)=>setTimeout(fn,ms), clear:id=>clearTimeout(id)}) {
    notify('입력 전달됨 · 폴더 선택창 여는 중…');
    if (typeof win.showDirectoryPicker !== 'function') throw new Error('이 실행 환경에서 폴더 선택 API를 사용할 수 없습니다. 데스크톱 Chrome/Edge의 일반 PixAI 탭에서 확인해 주세요.');
    // Call synchronously in the trusted gesture, before locks/storage/awaits.
    const pending = win.showDirectoryPicker({id:'pixai-queue', mode:'readwrite'});
    const timer = timers.set(() => notify('폴더 선택창 응답 대기 중 · Alt+Tab으로 다른 창 뒤에 열린 선택창이 있는지 확인해 주세요. 자동 재호출하지 않습니다.'), 8000);
    try {
      const chosen = await pending;
      notify('폴더 선택됨 · 쓰기 권한과 기록 확인 중…');
      return chosen;
    } finally { timers.clear(timer); }
  }

  function recover(jobs) {
    for (const job of jobs) {
      if (job.state === 'submitting') {
        job.state = job.taskId ? 'waiting' : 'unknown';
        job.error = '페이지가 닫혀 제출 결과를 확정할 수 없습니다. 자동 재생성하지 않습니다.';
      }
    }
    return jobs;
  }
  function verifyTask(job, task) {
    if (String(task?.id) !== job.taskId) throw new Error('작업 ID 불일치');
    if (job.submittedAt && (!Number.isFinite(Date.parse(task.createdAt)) || Date.parse(task.createdAt) < job.submittedAt - 5000)) {
      throw new Error('이전에 생성한 작업이거나 제출 시간을 확인할 수 없습니다.');
    }
    const parameters = jsonObject(task.parameters);
    const original = parameters.extra?.naturalPrompts ?? parameters.prompts;
    // Public REST omits prompt parameters. Receipt ID + creation time are the
    // available evidence; do not fabricate server confirmation of the prompt.
    if (job.queryBackend === 'official-v1' && original == null) return parameters;
    if (normalize(original) !== normalize(job.prompt)) throw new Error('해당 작업의 프롬프트가 대기열과 다릅니다.');
    return parameters;
  }
  function outputIds(task, expected) {
    const outputs = jsonObject(task.outputs);
    const ids = Array.isArray(outputs.mediaIds) ? outputs.mediaIds.map(String) : Array.isArray(outputs.batch)
      ? outputs.batch.map(item => String(item.mediaId ?? ''))
      : [String(task.mediaId ?? outputs.mediaId ?? '')];
    if (ids.length !== expected || ids.some(id => !/^\d+$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error('원본 이미지 개수를 확정할 수 없습니다. 저장과 다음 생성을 중단합니다.');
    }
    return ids;
  }

  // Dependency-injected runner: the browser adapter is the only code that clicks Generate.
  async function submitJob(job, io) {
    if (!resumable.has(job.state)) throw new Error(job.error || '이 작업은 자동으로 재개할 수 없습니다.');
    if (job.state === 'queued') {
      const prepared = await io.prepare(job);
      Object.assign(job, prepared, {state: 'submitting', error: '', submittedAt:Date.now()});
      io.persist(); // Must succeed BEFORE the single paid click.
      try {
        job.taskId = await io.submit(job);
        if (!/^\d+$/.test(job.taskId)) throw new Error('제출된 작업 ID를 확인하지 못했습니다.');
        job.state = 'waiting';
        io.persist();
      } catch (error) {
        job.state = job.taskId ? 'waiting' : error.notSubmitted ? 'queued' : 'unknown';
        job.error = error.message;
        io.persist();
        throw error;
      }
    }
  }
  async function processJob(job, io) {
    await submitJob(job, io);
    try {
      const task = await io.waitTask(job);
      verifyTask(job, task);
      const status = String(task.status).toLowerCase();
      if (!['completed', 'succeeded', 'success', 'done'].includes(status)) throw new Error('생성 완료 상태가 아닙니다.');
      const ids = outputIds(task, job.expected);
      job.state = 'saving';
      job.mediaIds = ids;
      job.saved ??= [];
      io.persist();
      for (let index = 0; index < ids.length; index++) {
        const mediaId = ids[index];
        if (job.saved.some(item => item.mediaId === mediaId)) continue;
        const file = await io.saveImage(job, mediaId, index);
        job.saved.push({mediaId, file});
        io.persist();
      }
      if (io.saveMetadata) await io.saveMetadata(job);
      job.state = 'done';
      job.error = '';
      io.persist();
    } catch (error) {
      job.state = job.state === 'saving' ? 'save_failed' : 'waiting';
      job.error = error.message;
      io.persist();
      throw error;
    }
  }

  async function runQueue(jobs, io, {limit=3, oneJob=false, stopped=()=>false}={}) {
    presetInteger(limit,'미리 등록할 작업 수',1,10);
    const pending = () => jobs.filter(job=>!['done','skipped'].includes(job.state));
    // Resolve existing paid IDs before spending credits on any new work after a restart.
    for (const job of pending()) {
      if (stopped()) return;
      if (!resumable.has(job.state)) throw new Error(job.error || '확인 필요한 작업을 먼저 해결해 주세요.');
      if (oneJob) {await processJob(job,io);return;}
      if (job.state !== 'queued') await processJob(job,io);
    }
    while (!stopped() && pending().length) {
      const current=pending();
      if (current.some(job=>!resumable.has(job.state))) throw new Error('확인 필요한 작업을 먼저 해결해 주세요.');
      let active=current.filter(job=>job.state!=='queued').length;
      for (const job of current) {
        if (stopped() || active>=limit) break;
        if (job.state==='queued') {await submitJob(job,io);active++;}
      }
      if (stopped()) return;
      const first=pending().find(job=>job.state!=='queued');
      if (!first) return;
      await processJob(first,io);
    }
  }

  function makePresetLibrary() {
    return {version:1, common:{prompt:'', negativePrompt:''}, presets:[], characters:[], characterFolders:[], chunkFolders:[], scenes:[], reservations:[]};
  }
  function presetText(value) {
    if (value != null && typeof value !== 'string') throw new Error('프롬프트와 이름은 문자열이어야 합니다.');
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
  }
  function presetIdentifier(value, label, numeric = false) {
    const result = presetText(value);
    if (!result || (numeric && !/^\d+$/.test(result))) throw new Error(`${label} ID를 확인해 주세요.`);
    return result;
  }
  function presetInteger(value, label, min, max) {
    if (!['number','string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) {
      throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 합니다.`);
    }
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 합니다.`);
    return result;
  }
  function presetObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 형식을 확인해 주세요.`);
    return value;
  }
  function validatePresetConfiguration(value, options = {}) {
    const source = presetObject(value, '모델·LoRA 설정');
    const model = presetObject(source.model, '모델');
    const minWeight = options.minLoraWeight ?? -2;
    const maxWeight = options.maxLoraWeight ?? 2;
    if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight) || minWeight > maxWeight) throw new Error('LoRA 수치 허용 범위가 잘못됐습니다.');
    if (!Array.isArray(source.loras)) throw new Error('LoRA 목록 형식을 확인해 주세요.');
    const seen = new Set();
    const loras = source.loras.map(item => {
      presetObject(item, 'LoRA');
      const id = presetIdentifier(item.id, 'LoRA', true);
      if (seen.has(id)) throw new Error(`같은 LoRA가 중복됐습니다: ${id}`);
      seen.add(id);
      if (!['number','string'].includes(typeof item.weight) || (typeof item.weight === 'string' && !item.weight.trim())) {
        throw new Error(`LoRA ${id} 수치를 입력해 주세요.`);
      }
      const weight = Number(item.weight);
      if (!Number.isFinite(weight) || weight < minWeight || weight > maxWeight) throw new Error(`LoRA ${id} 수치는 ${minWeight}~${maxWeight} 사이여야 합니다.`);
      const lora = {id, name:presetText(item.name), weight};
      if (item.versionId != null && presetText(item.versionId)) lora.versionId = presetIdentifier(item.versionId, 'LoRA 버전', true);
      if (Object.prototype.hasOwnProperty.call(item, 'triggerWords')) {
        if (typeof item.triggerWords !== 'string') throw new Error(`LoRA ${id} 트리거는 문자열이어야 합니다.`);
        const triggerWords = presetText(item.triggerWords);
        if (triggerWords) lora.triggerWords = triggerWords;
      }
      return lora;
    });
    const normalizedModel = {id:presetIdentifier(model.id, '모델', true), name:presetText(model.name),
      versionId:presetIdentifier(model.versionId, '모델 버전', true)};
    if (model.family != null) normalizedModel.family = presetText(model.family);
    return {model:normalizedModel, loras};
  }
  function normalizeReservationImageOptions(value) {
    const source=settingsBackupKeys(value,'예약 이미지 설정',['aspectRatio','size'],['aspectRatio','size','mode','batchSize']);
    if (!API_RATIOS.includes(source.aspectRatio) || !['1k','1.5k'].includes(source.size)) throw new Error('예약 이미지 비율·크기를 확인해 주세요.');
    const result={aspectRatio:source.aspectRatio,size:source.size};
    if (Object.hasOwn(source,'mode')) {if (!['','lite','standard','pro','ultra'].includes(source.mode)) throw new Error('예약 생성 모드를 확인해 주세요.');result.mode=source.mode;}
    if (Object.hasOwn(source,'batchSize')) {if (![1,4].includes(source.batchSize)) throw new Error('예약 생성당 이미지 수는 1장 또는 4장입니다.');result.batchSize=source.batchSize;}
    return result;
  }
  function normalizeComposeDraft(value) {
    const source=settingsBackupKeys(value,'조합 편집 상태',['presetId','characterId','sceneIds','triggerPosition','count','imageOptions']);
    if (!Array.isArray(source.sceneIds) || source.sceneIds.length>1000 || new Set(source.sceneIds).size!==source.sceneIds.length) throw new Error('조합 편집 청크 목록을 확인해 주세요.');
    return {presetId:source.presetId==='' ? '' : presetIdentifier(source.presetId,'편집 프리셋'),characterId:source.characterId==='' ? '' : presetIdentifier(source.characterId,'편집 캐릭터'),
      sceneIds:source.sceneIds.map(id=>presetIdentifier(id,'편집 청크')),triggerPosition:normalizeTriggerPosition(source.triggerPosition,source.sceneIds.length),
      count:presetInteger(source.count,'편집 횟수',1,100),imageOptions:normalizeReservationImageOptions(source.imageOptions)};
  }
  function normalizePresetLibrary(value, options = {}) {
    const source = presetObject(value, '프리셋 라이브러리');
    if (source.version !== 1) throw new Error('지원하지 않는 프리셋 라이브러리 버전입니다.');
    const common = presetObject(source.common, '공통 프롬프트');
    function entries(key, build, optional = false) {
      if (optional && !Object.prototype.hasOwnProperty.call(source, key)) return [];
      if (!Array.isArray(source[key])) throw new Error(`${key} 목록 형식을 확인해 주세요.`);
      const seen = new Set();
      return source[key].map(item => {
        presetObject(item, key);
        const id = presetIdentifier(item.id, key);
        if (seen.has(id)) throw new Error(`${key} ID가 중복됐습니다: ${id}`);
        seen.add(id);
        return build(item, id);
      });
    }
    const chunkFolders = entries('chunkFolders', (item, id) => {
      if (typeof item.name !== 'string' || !presetText(item.name)) throw new Error('청크 폴더 이름을 입력해 주세요.');
      return {id, name:presetText(item.name)};
    }, true);
    const folderIds = new Set(chunkFolders.map(item => item.id));
    const characterFolders=entries('characterFolders',(item,id)=>{
      if (typeof item.name!=='string' || !presetText(item.name)) throw new Error('캐릭터 폴더 이름을 입력해 주세요.');
      return {id,name:presetText(item.name)};
    },true),characterFolderIds=new Set(characterFolders.map(item=>item.id));
    const library = {
      version:1,
      common:{prompt:presetText(common.prompt), negativePrompt:presetText(common.negativePrompt)},
      presets:entries('presets', (item,id)=>{const preset={id,name:presetText(item.name),...validatePresetConfiguration(item,options)};for(const key of ['prompt','negativePrompt'])if(Object.hasOwn(item,key))preset[key]=presetText(item[key]);if(item.commonPresetId!=null&&presetText(item.commonPresetId))preset.commonPresetId=presetIdentifier(item.commonPresetId,'공통문 세트');return preset;}),
      characters:entries('characters', (item, id) => {
        const character={id,name:presetText(item.name),prompt:presetText(item.prompt),negativePrompt:presetText(item.negativePrompt)};
        if(item.defaultPresetId!=null&&presetText(item.defaultPresetId))character.defaultPresetId=presetIdentifier(item.defaultPresetId,'기본 프리셋');
        if (Object.hasOwn(item,'folderId')) {const folderId=presetIdentifier(item.folderId,'캐릭터 폴더');if (!characterFolderIds.has(folderId)) throw new Error(`캐릭터 ${id}의 폴더가 없습니다: ${folderId}`);character.folderId=folderId;}
        return character;
      }),
      characterFolders,
      chunkFolders,
      scenes:entries('scenes', (item, id) => {
        const chunk = {id, name:presetText(item.name), prompt:presetText(item.prompt), negativePrompt:presetText(item.negativePrompt)};
        if (Object.prototype.hasOwnProperty.call(item, 'folderId')) {
          const folderId = presetIdentifier(item.folderId, '청크 폴더');
          if (!folderIds.has(folderId)) throw new Error(`청크 ${id}의 폴더가 없습니다: ${folderId}`);
          chunk.folderId = folderId;
        }
        return chunk;
      }),
      reservations:entries('reservations', (item, id) => {
        const sourceIds = Object.prototype.hasOwnProperty.call(item, 'sceneIds') ? item.sceneIds : [item.sceneId];
        if (!Array.isArray(sourceIds)) throw new Error('선택한 프롬프트 청크 목록 형식을 확인해 주세요.');
        const sceneIds = sourceIds.map(sceneId => presetIdentifier(sceneId, '프롬프트 청크'));
        if (new Set(sceneIds).size !== sceneIds.length) throw new Error('같은 프롬프트 청크를 중복 선택할 수 없습니다.');
        const reservation = {id,
          presetId:presetIdentifier(item.presetId, '설정 프리셋'),
          characterId:presetIdentifier(item.characterId, '캐릭터'), sceneIds,
          count:presetInteger(item.count, '예약 반복 횟수', 1, 100)};
        if (Object.hasOwn(item,'triggerPosition')) reservation.triggerPosition=normalizeTriggerPosition(item.triggerPosition,sceneIds.length);
        if (Object.hasOwn(item,'imageOptions')) reservation.imageOptions=normalizeReservationImageOptions(item.imageOptions);
        if(Object.hasOwn(item,'sourceSceneId'))reservation.sourceSceneId=presetIdentifier(item.sourceSceneId,'원본 씬');
        if(Object.hasOwn(item,'batch'))reservation.batch=normalizeBatchTag(item.batch);
        if (Object.hasOwn(item,'snapshot')) {
          reservation.snapshot = normalizeCombinationSnapshot(item.snapshot);
          const frozen=reservation.snapshot;
          if (frozen.preset.id!==reservation.presetId || frozen.character.id!==reservation.characterId || JSON.stringify(frozen.chunks.map(chunk=>chunk.id))!==JSON.stringify(sceneIds)) throw new Error('예약 사본과 재료 ID가 다릅니다.');
        }
        return reservation;
      })
    };
    if (Object.hasOwn(source,'combinations')) {
      library.combinations=entries('combinations',(item,id)=>{
        const sceneIds=item.sceneIds;
        if (!Array.isArray(sceneIds) || new Set(sceneIds).size!==sceneIds.length) throw new Error('조합 기록의 청크 순서를 확인해 주세요.');
        if (typeof item.favorite!=='boolean') throw new Error('조합 즐겨찾기 형식을 확인해 주세요.');
        return {id,presetId:presetIdentifier(item.presetId,'기록 프리셋'),characterId:presetIdentifier(item.characterId,'기록 캐릭터'),
          sceneIds:sceneIds.map(id=>presetIdentifier(id,'기록 청크')),count:presetInteger(item.count,'기록 횟수',1,100),
          ...(Object.hasOwn(item,'triggerPosition') ? {triggerPosition:normalizeTriggerPosition(item.triggerPosition,sceneIds.length)} : {}),
          ...(Object.hasOwn(item,'imageOptions') ? {imageOptions:normalizeReservationImageOptions(item.imageOptions)} : {}),
          favorite:item.favorite,name:presetText(item.name),at:presetInteger(item.at,'기록 시각',0,Number.MAX_SAFE_INTEGER)};
      });
      if (library.combinations.filter(item=>!item.favorite).length>50 || library.combinations.filter(item=>item.favorite).length>1000) throw new Error('최근 조합은 50개, 즐겨찾기는 1,000개까지 저장할 수 있습니다.');
    }
    if(Object.hasOwn(source,'commonPresets'))library.commonPresets=entries('commonPresets',(item,id)=>{const name=presetText(item.name);if(!name)throw Error('공통문 세트 이름을 입력해 주세요.');return {id,name,...normalizeExtraText({prompt:item.prompt,negativePrompt:item.negativePrompt},'공통문 세트')};});
    if(Object.hasOwn(source,'sceneFolders'))library.sceneFolders=entries('sceneFolders',(item,id)=>{const name=presetText(item.name);if(!name)throw Error('씬 그룹 이름을 입력해 주세요.');return {id,name};});
    if(Object.hasOwn(source,'sceneCards'))library.sceneCards=entries('sceneCards',(item,id)=>normalizeSceneCard(item,id,new Set((library.sceneFolders||[]).map(folder=>folder.id))));
    if(Object.hasOwn(source,'casts'))library.casts=entries('casts',normalizeCast);
    if(Object.hasOwn(source,'batchPlans'))library.batchPlans=entries('batchPlans',(item,id)=>normalizeBatchPlan(item,id));
    if (library.reservations.reduce((sum, item) => sum + item.count, 0) > 1000) throw new Error('예약 작업은 한 번에 1,000개까지 만들 수 있습니다.');
    return library;
  }
  function normalizeCombinationSnapshot(value) {
    const source=settingsBackupKeys(value,'예약 사본',['common','preset','character','chunks'],['common','preset','character','chunks','extras']);
    const frozen=settingsBackupLibrary({version:1,common:source.common,presets:[source.preset],characters:[source.character],scenes:source.chunks,reservations:[]},{frozen:true});
    const result={common:frozen.common,preset:frozen.presets[0],character:frozen.characters[0],chunks:frozen.scenes};
    if(Object.hasOwn(source,'extras')){const extras=settingsBackupKeys(source.extras,'사본 추가 문구',[],['cast','scene']);result.extras={};for(const key of ['cast','scene'])if(Object.hasOwn(extras,key))result.extras[key]=normalizeExtraText(extras[key],'추가 문구');}return result;
  }
  function resolveCombination(value, combination) {
    const library=normalizePresetLibrary(value),missing=[];
    const preset=library.presets.find(item=>item.id===combination.presetId),character=library.characters.find(item=>item.id===combination.characterId);
    if (!preset) missing.push('프리셋');if (!character) missing.push('캐릭터');
    const sceneIds=[];
    for (const id of combination.sceneIds) {if (library.scenes.some(item=>item.id===id)) sceneIds.push(id);else missing.push(`청크 ${id}`);}
    return {presetId:preset?.id || '',characterId:character?.id || '',sceneIds,count:combination.count,missing,
      ...(Object.hasOwn(combination,'imageOptions') ? {imageOptions:normalizeReservationImageOptions(combination.imageOptions)} : {}),
      ...(Object.hasOwn(combination,'triggerPosition') ? {triggerPosition:combination.triggerPosition==='end' ? 'end' : Math.min(normalizeTriggerPosition(combination.triggerPosition,combination.sceneIds.length),sceneIds.length+2)} : {})};
  }
  function snapshotCombination(value, combination) {
    const library=normalizePresetLibrary(value),resolved=resolveCombination(library,combination);
    if (resolved.missing.length) throw new Error(`조합 재료가 없습니다: ${resolved.missing.join(', ')}`);
    const {folderId,...character}=library.characters.find(item=>item.id===resolved.characterId);
    return normalizeCombinationSnapshot({common:resolvePresetCommon(library,library.presets.find(item=>item.id===resolved.presetId)),preset:library.presets.find(item=>item.id===resolved.presetId),character,
      chunks:resolved.sceneIds.map(id=>{const {folderId,...chunk}=library.scenes.find(item=>item.id===id);return chunk;})});
  }
  function rememberCombination(value, combination, options={}) {
    const library=normalizePresetLibrary(value),entries=library.combinations || [];
    const imageOptions=Object.hasOwn(combination,'imageOptions') ? normalizeReservationImageOptions(combination.imageOptions) : undefined;
    const previous=entries.find(item=>item.presetId===combination.presetId && item.characterId===combination.characterId && JSON.stringify(item.sceneIds)===JSON.stringify(combination.sceneIds) && normalizeTriggerPosition(item.triggerPosition,item.sceneIds.length)===normalizeTriggerPosition(combination.triggerPosition,combination.sceneIds.length) && JSON.stringify(item.imageOptions || null)===JSON.stringify(imageOptions || null));
    const entry={id:previous?.id || (options.idFactory || (()=>globalThis.crypto.randomUUID()))(),presetId:combination.presetId,characterId:combination.characterId,sceneIds:[...combination.sceneIds],count:combination.count,
      ...(Object.hasOwn(combination,'triggerPosition') ? {triggerPosition:combination.triggerPosition} : {}),
      ...(imageOptions ? {imageOptions} : {}),
      favorite:!!options.favorite || !!previous?.favorite,name:previous?.name || '',at:options.now ?? Date.now()};
    let recent=0;
    library.combinations=[entry,...entries.filter(item=>item.id!==entry.id)].filter(item=>item.favorite || ++recent<=50);
    return normalizePresetLibrary(library);
  }
  function promptFolderSpec(key) {
    if (!['scenes','characters'].includes(key)) throw new Error('프롬프트 목록을 확인해 주세요.');
    return key==='characters' ? {folderKey:'characterFolders',label:'캐릭터'} : {folderKey:'chunkFolders',label:'청크'};
  }
  function orderedChunks(value,key='scenes') {
    const library = normalizePresetLibrary(value);
    const {folderKey}=promptFolderSpec(key);
    return [...library[key].filter(item => !item.folderId),
      ...library[folderKey].flatMap(folder => library[key].filter(item => item.folderId === folder.id))];
  }
  function moveLibraryItem(value, key, id, direction) {
    if (!['presets','characters','scenes','chunkFolders','characterFolders','reservations'].includes(key)) throw new Error('순서를 변경할 목록을 확인해 주세요.');
    if (direction !== -1 && direction !== 1) throw new Error('이동 방향은 위 또는 아래여야 합니다.');
    const library = normalizePresetLibrary(value);
    const items = library[key], itemId = presetIdentifier(id, '이동할 항목');
    const index = items.findIndex(item => item.id === itemId);
    if (index < 0) throw new Error('순서를 변경할 항목이 없습니다.');
    const indexes = items.map((_item, itemIndex) => itemIndex)
      .filter(itemIndex => !['scenes','characters'].includes(key) || items[itemIndex].folderId === items[index].folderId);
    const target = indexes[indexes.indexOf(index) + direction];
    if (target !== undefined) [items[index], items[target]] = [items[target], items[index]];
    return library;
  }

  function placeLibraryItem(value,key,id,targetId,after=false) {
    if (!['presets','characters','chunkFolders','characterFolders','reservations'].includes(key)) throw new Error('순서를 바꿀 목록을 확인해 주세요.');
    const next=normalizePresetLibrary(value),items=next[key];
    if (!items.some(item=>item.id===id) || !items.some(item=>item.id===targetId)) throw new Error('이동할 항목을 확인해 주세요.');
    if (id===targetId) return next;
    const [item]=items.splice(items.findIndex(item=>item.id===id),1);
    items.splice(items.findIndex(item=>item.id===targetId)+(after ? 1 : 0),0,item);
    return next;
  }
  function removeChunkFolder(value, id,key='scenes') {
    const {folderKey,label}=promptFolderSpec(key),library = normalizePresetLibrary(value), folderId = presetIdentifier(id, `${label} 폴더`);
    if (!library[folderKey].some(item => item.id === folderId)) throw new Error(`삭제할 ${label} 폴더가 없습니다.`);
    library[folderKey] = library[folderKey].filter(item => item.id !== folderId);
    for (const chunk of library[key]) if (chunk.folderId === folderId) delete chunk.folderId;
    return library;
  }
  function paneRatios(value, fallback) {
    const source=Array.isArray(value)&&value.length===fallback.length&&value.every(item=>Number.isFinite(item)&&item>0) ? value : fallback;
    const largest=Math.max(...source),scaled=source.map(item=>item/largest),sum=scaled.reduce((total,item)=>total+item,0);return scaled.map(item=>item/sum);
  }
  function resizePanePair(value,index,delta,minimums) {
    const next=[...value],total=next[index]+next[index+1];
    const scale=Math.min(1,total/(minimums[index]+minimums[index+1]));
    const left=Math.min(total-minimums[index+1]*scale,Math.max(minimums[index]*scale,next[index]+delta));
    next[index]=left;next[index+1]=total-left;return next;
  }
  function bindPaneResize(host,panes,io) {
    let ratios=paneRatios(null,io.initial),drag=null;
    try {ratios=paneRatios(io.load?.(),io.initial);}catch { /* Layout storage does not block the editor. */ }
    const handles=panes.slice(1).map((_pane,index)=>io.createHandle(index));
    host.replaceChildren(...panes.flatMap((pane,index)=>index ? [handles[index-1],pane] : [pane]));
    function draw() {
      panes.forEach((pane,index)=>{pane.style.flex=`${ratios[index]} 1 0px`;});
      handles.forEach((handle,index)=>handle.setAttribute('aria-valuenow',String(Math.round(ratios[index]/(ratios[index]+ratios[index+1])*100))));
    }
    function measure() {
      const width=Math.max(1,host.getBoundingClientRect().width-handles.length*8);
      const scale=Math.min(1,width/io.minimums.reduce((sum,item)=>sum+item,0));
      return {width,minimums:io.minimums.map(item=>item*scale/width)};
    }
    function remember() {try {io.save?.([...ratios]);}catch { /* Keep the usable layout in this tab. */ }}
    for (const [index,handle] of handles.entries()) {
      handle.addEventListener('pointerdown',event=>{
        if (event.isTrusted===false || event.button!==0 || event.isPrimary===false || drag || io.enabled?.()===false) return;
        drag={id:event.pointerId,index,startX:event.clientX,start:[...ratios],...measure()};
        handle.setPointerCapture(event.pointerId);host.dataset.resizing='true';event.preventDefault();event.stopPropagation();
      });
      handle.addEventListener('pointermove',event=>{
        if (!drag || drag.id!==event.pointerId || drag.index!==index) return;
        ratios=resizePanePair(drag.start,index,(event.clientX-drag.startX)/drag.width,drag.minimums);draw();event.preventDefault();
      });
      function finish(event) {
        if (!drag || drag.id!==event.pointerId || drag.index!==index) return;
        const previous=drag.start,commit=event.type==='pointerup';drag=null;delete host.dataset.resizing;
        if (!commit) ratios=previous;draw();
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        if (commit) remember();
      }
      for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type,finish);
      handle.addEventListener('keydown',event=>{
        if (event.isTrusted===false || io.enabled?.()===false || !['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
        event.preventDefault();
        ratios=event.key==='Home' ? paneRatios(null,io.initial) : resizePanePair(ratios,index,event.key==='ArrowRight' ? .025 : -.025,measure().minimums);
        draw();remember();
      });
      handle.addEventListener('dblclick',event=>{if (event.isTrusted===false || io.enabled?.()===false) return;ratios=paneRatios(null,io.initial);draw();remember();});
    }
    draw();return {ratios:()=>[...ratios]};
  }
  function bindWindowResize(target,handle,io) {
    let drag=null,size=null,preferred=null;
    function apply(value) {
      const viewport=io.viewport(),rect=target.getBoundingClientRect();
      const width=Math.min(viewport.width-16,Math.max(Math.min(560,viewport.width-16),value.width));
      const height=Math.min(viewport.height-16,Math.max(Math.min(420,viewport.height-16),value.height));
      size={width,height};Object.assign(target.style,{width:`${width}px`,height:`${height}px`});
      if (target.dataset.minimized!=='true') {
        const position=clampPosition({x:value.x ?? rect.left,y:value.y ?? rect.top},size,viewport);
        Object.assign(target.style,{left:`${position.x}px`,top:`${position.y}px`,right:'auto',bottom:'auto'});
      }
    }
    try {const saved=io.load?.();if (Number.isFinite(saved?.width)&&Number.isFinite(saved?.height)&&saved.width>0&&saved.height>0) {preferred={width:saved.width,height:saved.height};apply(preferred);}}catch { /* Ignore invalid size storage. */ }
    handle.addEventListener('pointerdown',event=>{
      if (event.isTrusted===false || event.button!==0 || event.isPrimary===false || drag || target.dataset.minimized==='true') return;
      const rect=target.getBoundingClientRect();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,start:{width:rect.width,height:rect.height,x:rect.left,y:rect.top}};
      handle.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
    });
    handle.addEventListener('pointermove',event=>{if (!drag || drag.id!==event.pointerId) return;apply({width:drag.start.width+event.clientX-drag.startX,height:drag.start.height+event.clientY-drag.startY});event.preventDefault();});
    function finish(event) {
      if (!drag || drag.id!==event.pointerId) return;
      const previous=drag.start,commit=event.type==='pointerup';drag=null;if (!commit) apply(previous);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (commit) {const current=size || previous;preferred={width:current.width,height:current.height};try {io.save?.(preferred);}catch { /* Size still works in this tab. */ }}
    }
    for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type,finish);
    handle.addEventListener('keydown',event=>{
      if (event.isTrusted===false || target.dataset.minimized==='true' || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();const rect=target.getBoundingClientRect();apply({width:rect.width+(event.key==='ArrowRight' ? 24 : event.key==='ArrowLeft' ? -24 : 0),height:rect.height+(event.key==='ArrowDown' ? 24 : event.key==='ArrowUp' ? -24 : 0)});
      preferred={...size};try {io.save?.(preferred);}catch { /* Keyboard resize does not need storage. */ }
    });
    io.onResize?.(()=>{if ((preferred || size) && !drag) apply(preferred || size);});
  }
  function selectedChunks(library, ids,key='scenes') {
    const {label}=promptFolderSpec(key);
    if (!Array.isArray(ids) || !ids.length) throw new Error(`${label}를 하나 이상 선택해 주세요.`);
    const selected=new Set(ids.map(id=>presetIdentifier(id,`선택한 ${label}`)));
    if (selected.size!==ids.length || ids.some(id=>!library[key].some(item=>item.id===id))) throw new Error(`선택한 ${label}가 없거나 중복됐습니다.`);
    return orderedChunks(library,key).filter(item=>selected.has(item.id));
  }
  function moveChunksTo(value, ids, folderId, targetId = null, after = false,key='scenes') {
    const {folderKey,label}=promptFolderSpec(key),library=normalizePresetLibrary(value),chunks=selectedChunks(library,ids,key),selected=new Set(ids);
    if (typeof folderId!=='string' || (folderId && !library[folderKey].some(item=>item.id===folderId))) throw new Error(`이동할 ${label} 폴더가 없습니다.`);
    if (typeof after!=='boolean') throw new Error(`${label}를 놓을 위치를 확인해 주세요.`);
    const target=targetId===null ? null : library[key].find(item=>item.id===presetIdentifier(targetId,`대상 ${label}`));
    if (targetId!==null && (!target || (target.folderId || '')!==folderId)) throw new Error(`${label}를 놓을 대상과 폴더를 확인해 주세요.`);
    if (target && selected.has(target.id)) return library;
    library[key]=library[key].filter(item=>!selected.has(item.id));
    for (const chunk of chunks) {if (folderId) chunk.folderId=folderId;else delete chunk.folderId;}
    let position=library[key].length;
    if (target) position=library[key].findIndex(item=>item.id===target.id)+(after ? 1 : 0);
    else {
      const last=library[key].map((item,itemIndex)=>(item.folderId || '')===folderId ? itemIndex : -1).filter(itemIndex=>itemIndex>=0).at(-1);
      if (last!==undefined) position=last+1;
    }
    library[key].splice(position,0,...chunks);return library;
  }
  function removeChunks(value,ids,key='scenes') {
    const library=normalizePresetLibrary(value);selectedChunks(library,ids,key);
    const selected=new Set(ids);library[key]=library[key].filter(item=>!selected.has(item.id));return library;
  }
  function duplicateChunks(value,ids,idFactory=()=>crypto.randomUUID(),key='scenes') {
    const {label}=promptFolderSpec(key),library=normalizePresetLibrary(value),chunks=selectedChunks(library,ids,key),copies=new Map();
    const names=new Set(library[key].map(item=>item.name)),identities=new Set(library[key].map(item=>item.id));
    for (const chunk of chunks) {
      const id=presetIdentifier(idFactory(),`복제 ${label}`);
      if (identities.has(id)) throw new Error(`복제 ${label} ID가 중복됐습니다.`);identities.add(id);
      let name=`${chunk.name} (복사본)`,number=2;
      while (names.has(name)) name=`${chunk.name} (복사본 ${number++})`;
      names.add(name);copies.set(chunk.id,{...chunk,id,name});
    }
    library[key]=library[key].flatMap(chunk=>copies.has(chunk.id) ? [chunk,copies.get(chunk.id)] : [chunk]);
    return library;
  }
  function createChunkFolder(value,name,ids=[],idFactory=()=>crypto.randomUUID(),key='scenes') {
    const {folderKey,label}=promptFolderSpec(key),library=normalizePresetLibrary(value),title=presetText(name).trim();
    if (!title) throw new Error('새 폴더 이름을 입력해 주세요.');
    if (library[folderKey].some(item=>item.name.toLocaleLowerCase()===title.toLocaleLowerCase())) throw new Error('같은 이름의 폴더가 있습니다. 목록에서 그 폴더를 선택해 주세요.');
    const id=presetIdentifier(idFactory(),`새 ${label} 폴더`);
    if (library[folderKey].some(item=>item.id===id)) throw new Error('새 폴더 ID가 중복됐습니다.');
    library[folderKey].push({id,name:title});
    return ids.length ? moveChunksTo(library,ids,id,null,false,key) : library;
  }
  function settingsBackupKeys(value, label, required, allowed = required) {
    const source = presetObject(value, label);
    if (required.some(key => !Object.prototype.hasOwnProperty.call(source, key)) || Object.keys(source).some(key => !allowed.includes(key))) {
      throw new Error(`${label}의 필수 항목이나 형식을 확인해 주세요.`);
    }
    return source;
  }
  function normalizeSettingsOptions(value) {
    const source = settingsBackupKeys(value, '대기열 옵션', ['maxCredits','filePrefix','repeat'], ['maxCredits','filePrefix','repeat','maxInFlight','imageCount','api','embedMetadata']);
    if (source.maxCredits !== null && (typeof source.maxCredits !== 'number' || !Number.isSafeInteger(source.maxCredits) || source.maxCredits < 1)) {
      throw new Error('크레딧 상한은 양의 정수 또는 제한 없음이어야 합니다.');
    }
    if (typeof source.filePrefix !== 'string') throw new Error('파일 이름은 문자열이어야 합니다.');
    if (typeof source.repeat !== 'number') throw new Error('반복 횟수는 1~100의 정수여야 합니다.');
    const extra={};
    if(Object.hasOwn(source,'embedMetadata')){if(typeof source.embedMetadata!=='boolean')throw Error('PNG 기록 옵션은 체크 상태여야 합니다.');extra.embedMetadata=source.embedMetadata;}
    if (Object.hasOwn(source,'api')) extra.api=normalizeApiOptions(source.api);
    if (Object.hasOwn(source,'maxInFlight')) extra.maxInFlight=presetInteger(source.maxInFlight,'미리 등록할 작업 수',1,10);
    if (Object.hasOwn(source,'imageCount')) {
      extra.imageCount=presetInteger(source.imageCount,'생성당 이미지 수',0,4);
      if (![0,1,4].includes(extra.imageCount)) throw new Error('생성당 이미지 수는 사이트 선택·1장·4장 중 골라 주세요.');
    }
    return {maxCredits:source.maxCredits, filePrefix:presetText(source.filePrefix), repeat:presetInteger(source.repeat, '반복 횟수', 1, 100),...extra};
  }
  function settingsBackupStrings(value, keys, label) {
    if (keys.some(key => Object.prototype.hasOwnProperty.call(value, key) && typeof value[key] !== 'string')) {
      throw new Error(`${label}은 문자열이어야 합니다.`);
    }
  }
  function settingsBackupLibrary(value,{frozen=false}={}) {
    const source = settingsBackupKeys(value, '프리셋 라이브러리', ['version','common','presets','characters','scenes','reservations'],
      ['version','common','presets','characters','characterFolders','chunkFolders','scenes','reservations','combinations','commonPresets','sceneCards','sceneFolders','casts','batchPlans']);
    settingsBackupKeys(source.common, '공통 프롬프트', ['prompt','negativePrompt']);
    settingsBackupStrings(source.common, ['prompt','negativePrompt'], '공통 프롬프트');
    const library = normalizePresetLibrary(source);
    for (const folder of [...(source.chunkFolders || []),...(source.characterFolders || []),...(source.sceneFolders || [])]) {
      settingsBackupKeys(folder, '프롬프트 폴더', ['id','name']);
      settingsBackupStrings(folder, ['name'], '프롬프트 폴더 이름');
    }
    for (const item of source.presets) {
      settingsBackupKeys(item, '설정 프리셋', ['id','name','model','loras'],['id','name','model','loras','prompt','negativePrompt','commonPresetId']);
      settingsBackupStrings(item, ['name','prompt','negativePrompt'], '프리셋 이름·문구');
      settingsBackupKeys(item.model, '모델', ['id','name','versionId'], ['id','name','versionId','family']);
      settingsBackupStrings(item.model, ['name','family'], '모델 이름');
      for (const lora of item.loras) {
        settingsBackupKeys(lora, 'LoRA', ['id','name','weight'], ['id','name','weight','versionId','triggerWords']);
        settingsBackupStrings(lora, ['name','triggerWords'], 'LoRA 이름·트리거');
      }
    }
    for (const key of ['characters','scenes']) for (const item of source[key]) {
      const fields = ['id','name','prompt','negativePrompt'];
      settingsBackupKeys(item, '캐릭터·청크 프롬프트', fields, [...fields,'folderId',...(key==='characters'?['defaultPresetId']:[])]);
      settingsBackupStrings(item, ['name','prompt','negativePrompt'], '캐릭터·청크 프롬프트');
    }
    for (const item of source.reservations) settingsBackupKeys(item, '조합 예약', ['id','presetId','characterId','count'], ['id','presetId','characterId','count','sceneId','sceneIds','snapshot','triggerPosition','imageOptions','sourceSceneId','batch']);
    for (const item of source.combinations || []) settingsBackupKeys(item,'조합 기록',['id','presetId','characterId','sceneIds','count','favorite','name','at'],['id','presetId','characterId','sceneIds','count','favorite','name','at','triggerPosition','imageOptions']);
    for(const item of source.commonPresets||[]) {settingsBackupKeys(item,'공통문 세트',['id','name','prompt','negativePrompt']);settingsBackupStrings(item,['name','prompt','negativePrompt'],'공통문 세트');}
    for(const item of source.sceneCards||[]) {settingsBackupKeys(item,'씬',['id','name','sceneIds','chunks'],['id','name','sceneIds','chunks','extra','imageOptions','triggerPosition','folderId']);for(const chunk of item.chunks)settingsBackupKeys(chunk,'씬 청크 사본',['id','name','prompt','negativePrompt']);}
    for(const item of source.casts||[])settingsBackupKeys(item,'출연',['id','name','characterId','presetId'],['id','name','characterId','presetId','extra','triggerPosition']);
    for(const item of source.batchPlans||[])normalizeBatchPlan(item,item.id);
    if(!frozen)for(const preset of library.presets)resolvePresetCommon(library,preset);
    return library;
  }
  function settingsBackupMeta(value) {
    const source = settingsBackupKeys(value, '백업 정보', ['appVersion','exportedAt']);
    if (typeof source.appVersion !== 'string' || !source.appVersion.trim()) throw new Error('백업의 스크립트 버전을 확인해 주세요.');
    if (typeof source.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(source.exportedAt)) {
      throw new Error('백업의 저장 시각을 확인해 주세요.');
    }
    const timestamp = Date.parse(source.exportedAt);
    if (!Number.isFinite(timestamp)) throw new Error('백업의 저장 시각을 확인해 주세요.');
    const exportedAt = new Date(timestamp).toISOString();
    const padded = source.exportedAt.replace(/(\.\d{1,3})?Z$/, (_match, fraction) => `${fraction ? fraction.padEnd(4,'0') : '.000'}Z`);
    if (padded !== exportedAt) throw new Error('백업의 저장 시각을 확인해 주세요.');
    return {appVersion:source.appVersion.trim(), exportedAt};
  }
  function makeSettingsBackup(library, options, meta) {
    meta=settingsBackupMeta(meta);
    return {format:'pixai-web-queue-settings', version:meta.appVersion?.startsWith('0.10.')||['commonPresets','sceneCards','sceneFolders','casts','batchPlans'].some(key=>Object.hasOwn(library,key))||Object.hasOwn(options,'embedMetadata')?2:1, ...settingsBackupMeta(meta),
      library:settingsBackupLibrary(library), options:normalizeSettingsOptions(options)};
  }
  function parseSettingsBackup(text) {
    if (typeof text !== 'string') throw new Error('설정 파일 내용을 읽을 수 없습니다.');
    const maxBytes = 5 * 1024 * 1024;
    if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('설정 파일은 5MiB 이하만 불러올 수 있습니다.');
    let value, forbiddenKey = false;
    try {
      value = JSON.parse(text.replace(/^\uFEFF/, ''), (key, item) => {
        if (['__proto__','prototype','constructor'].includes(key)) { forbiddenKey = true; throw new Error('허용하지 않는 객체 속성'); }
        return item;
      });
    } catch {
      throw new Error(forbiddenKey ? '설정 파일에 허용하지 않는 객체 속성이 있습니다.' : '설정 파일의 JSON 형식을 확인해 주세요.');
    }
    presetObject(value, '설정 백업');
    if (value.format === 'pixai-clack-helper-selection') {
      const transfer=parseTransferBackup(text),data=transfer.backup;
      return {...data,source:'selection',transfer};
    }
    if (Object.prototype.hasOwnProperty.call(value, 'format')) {
      if (value.format !== 'pixai-web-queue-settings' || ![1,2].includes(value.version)) throw new Error('지원하지 않는 설정 백업 형식 또는 버전입니다.');
      settingsBackupKeys(value, '설정 백업', ['format','version','appVersion','exportedAt','library','options']);
      return {source:'settings', ...settingsBackupMeta({appVersion:value.appVersion, exportedAt:value.exportedAt}),
        library:settingsBackupLibrary(value.library),...convertImportedOptions(value.options)};
    }
    if (Object.prototype.hasOwnProperty.call(value, 'library') || Object.prototype.hasOwnProperty.call(value, 'jobs')) {
      settingsBackupKeys(value, '예전 대기열 백업', ['version','jobs','library']);
      if (value.version !== 1 || !Array.isArray(value.jobs)) throw new Error('예전 대기열 백업 형식 또는 버전을 확인해 주세요.');
      return {source:'queue', appVersion:null, exportedAt:null, library:settingsBackupLibrary(value.library), options:null};
    }
    return {source:'library', appVersion:null, exportedAt:null, library:settingsBackupLibrary(value), options:null};
  }
  function normalizeTriggerPosition(value,chunkCount) {
    if (value===undefined) return 1; // Older recipes put triggers between common and character.
    if (value==='end') return value;
    if (!Number.isInteger(value) || value<0 || value>chunkCount+2) throw new Error('LoRA 트리거 위치를 확인해 주세요.');
    return value;
  }
  function composePresetPrompts(common, character, chunksOrLegacyScene, preset = {loras:[]}, triggerPosition=1, extras={}) {
    const commonPart = presetObject(common, '공통');
    const characterPart = presetObject(character, '캐릭터');
    const chunks = (Array.isArray(chunksOrLegacyScene) ? chunksOrLegacyScene : [chunksOrLegacyScene])
      .map(item => presetObject(item, '프롬프트 청크'));
    const configuration = presetObject(preset, '설정 프리셋');
    if (!Array.isArray(configuration.loras)) throw new Error('LoRA 목록 형식을 확인해 주세요.');
    const triggers = configuration.loras.map(item => {
      presetObject(item, 'LoRA');
      if (!Object.prototype.hasOwnProperty.call(item, 'triggerWords')) return '';
      if (typeof item.triggerWords !== 'string') throw new Error('LoRA 트리거는 문자열이어야 합니다.');
      return presetText(item.triggerWords);
    });
    const join=(...parts)=>parts.map(presetText).filter(Boolean).join(', ');
    const promptParts = [join(commonPart.prompt,configuration.prompt),join(characterPart.prompt,extras.cast?.prompt),...chunks.map(item => item.prompt)];
    const position=normalizeTriggerPosition(triggerPosition,chunks.length);
    if(position==='end')promptParts.push(extras.scene?.prompt || '',...triggers);else {promptParts.splice(position,0,...triggers);promptParts.push(extras.scene?.prompt || '');}
    const negativeParts = [join(commonPart.negativePrompt,configuration.negativePrompt),join(characterPart.negativePrompt,extras.cast?.negativePrompt),...chunks.map(item => item.negativePrompt),extras.scene?.negativePrompt || ''];
    return {
      prompt:promptParts.map(presetText).filter(Boolean).join(', '),
      negativePrompt:negativeParts.map(presetText).filter(Boolean).join(', ')
    };
  }
  function expandPresetReservations(value, options = {}) {
    const library = normalizePresetLibrary(value, options);
    const maxCredits = options.maxCredits == null || options.maxCredits === '' || (typeof options.maxCredits === 'string' && !options.maxCredits.trim())
      ? null : presetInteger(options.maxCredits, '생성 비용 상한', 1, Number.MAX_SAFE_INTEGER);
    const idFactory = options.idFactory ?? (() => globalThis.crypto.randomUUID());
    const prefix = presetText(options.titlePrefix);
    const jobs = [], ids = new Set();
    const copy = item => JSON.parse(JSON.stringify(item));
    for (const reservation of library.reservations) {
      const frozen=reservation.snapshot;
      const common=frozen?.common || resolvePresetCommon(library,library.presets.find(item=>item.id===reservation.presetId));
      const preset = frozen?.preset || library.presets.find(item => item.id === reservation.presetId);
      const character = frozen?.character || library.characters.find(item => item.id === reservation.characterId);
      if (!preset) throw new Error(`예약 ${reservation.id}의 설정 프리셋이 없습니다.`);
      if (!character) throw new Error(`예약 ${reservation.id}의 캐릭터가 없습니다.`);
      const chunks = frozen?.chunks || reservation.sceneIds.map(sceneId => {
        const chunk = library.scenes.find(item => item.id === sceneId);
        if (!chunk) throw new Error(`예약 ${reservation.id}의 프롬프트 청크가 없습니다: ${sceneId}`);
        return chunk;
      });
      const prompts = composePresetPrompts(common,character,chunks,preset,reservation.triggerPosition,frozen?.extras);
      if (!prompts.prompt) throw new Error(`예약 ${reservation.id}의 조합 프롬프트가 비어 있습니다.`);
      for (let repeat = 1; repeat <= reservation.count; repeat++) {
        const id = presetIdentifier(idFactory(), '작업');
        if (ids.has(id)) throw new Error('새 작업 ID가 중복됐습니다.');
        ids.add(id);
        jobs.push({id,
          title:[prefix, character.name || '캐릭터', chunks.map(item => item.name || '청크').join('+'), preset.name || '프리셋', repeat].filter(Boolean).join('_'),
          ...prompts, maxCredits, state:'queued', saved:[],
          ...(reservation.imageOptions ? {apiOptions:copy(Object.fromEntries(Object.entries(reservation.imageOptions).filter(([key])=>key!=='batchSize'))),...(reservation.imageOptions.batchSize ? {apiBatchSize:reservation.imageOptions.batchSize} : {})} : {}),
          configuration:copy({model:preset.model, loras:preset.loras}),
          composition:{version:2, reservation:copy({...reservation, repeat}), common:copy(common),
            preset:copy(preset), character:copy(character), chunks:copy(chunks)}
        });
      }
    }
    return jobs;
  }

  function parseModelLink(href) {
    const match = String(href || '').match(/^\/(?:[a-z]{2}\/)?model\/(\d+)\/(\d+)\/?(?:\?.*)?$/);
    return match ? {id:match[1],versionId:match[2]} : null;
  }
  function assertConfiguration(expected, actual) {
    const target = validatePresetConfiguration(expected);
    const current = validatePresetConfiguration(actual);
    if (target.model.id !== current.model.id || target.model.versionId !== current.model.versionId) throw new Error('선택된 모델 또는 모델 버전이 프리셋과 다릅니다. 생성하지 않습니다.');
    if (target.loras.length !== current.loras.length || target.loras.some(item => {
      const found = current.loras.find(value => value.id === item.id);
      return !found || (item.versionId && item.versionId !== found.versionId) || Math.abs(item.weight - found.weight) > 0.000001;
    })) throw new Error('선택된 LoRA·버전·수치가 프리셋과 다릅니다. 생성하지 않습니다.');
    return current;
  }
  function assertNumberField(field, value) {
    const number = Number(value), min = field.getAttribute('min'), max = field.getAttribute('max'), step = field.getAttribute('step');
    if (!Number.isFinite(number) || (min != null && number < Number(min)) || (max != null && number > Number(max))) throw new Error(`LoRA 수치는 사이트의 ${min ?? '?'}~${max ?? '?'} 범위 안이어야 합니다.`);
    const increment = Number(step);
    if (step && step !== 'any' && increment > 0 && Math.abs((number - Number(min || 0)) / increment - Math.round((number - Number(min || 0)) / increment)) > 0.000001) throw new Error(`LoRA 수치는 사이트의 ${step} 간격으로 입력해 주세요.`);
  }
  function createSettingsStore(storage, keys) {
    if (!keys || ['library','options','previous'].some(name => typeof keys[name] !== 'string' || !keys[name].trim()) || new Set(Object.values(keys)).size !== 3) {
      throw new Error('설정 저장 키를 확인해 주세요.');
    }
    const validRaw = value => value === null || typeof value === 'string';
    function snapshot() {
      const value = {library:storage.getItem(keys.library), options:storage.getItem(keys.options)};
      if (!validRaw(value.library) || !validRaw(value.options)) throw new Error('현재 설정 저장 형식을 확인해 주세요.');
      return value;
    }
    function previous() {
      const raw = storage.getItem(keys.previous);
      if (raw === null) throw new Error('복원할 이전 설정이 없습니다.');
      let value;
      try { value = JSON.parse(raw); } catch { throw new Error('이전 설정 복구 사본의 형식을 확인해 주세요.'); }
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value,'library') || !Object.hasOwn(value,'options') || !validRaw(value.library) || !validRaw(value.options)) {
        throw new Error('이전 설정 복구 사본의 형식을 확인해 주세요.');
      }
      return value;
    }
    function write(name, raw) {
      if (raw === null) storage.removeItem(keys[name]); else storage.setItem(keys[name], raw);
    }
    function rollback(original) {
      const errors = [];
      for (const name of ['library','options']) {
        try { write(name, original[name]); } catch (error) { errors.push(error); }
      }
      return errors;
    }
    function failure(label, error, rollbackErrors) {
      const restored = !rollbackErrors.length;
      const result = new Error(`${label}에 실패했습니다 [${error.name || 'Error'}]. ${restored ? '원래 설정으로 되돌렸습니다.' : '원본 복원도 실패해 일부 설정이 바뀌었을 수 있습니다. 저장 공간·권한을 확인하고 이전 설정 복원을 다시 시도해 주세요.'} 이전 설정 복구 사본은 보존했습니다.`);
      result.cause = error;
      result.rollbackFailed = !restored;
      return result;
    }
    return {
      apply(parsed) {
        const library = normalizePresetLibrary(parsed?.library);
        const options = parsed?.options === null ? null : normalizeSettingsOptions(parsed?.options);
        const nextLibrary = JSON.stringify(library), nextOptions = options === null ? null : JSON.stringify(options);
        const original = snapshot();
        try { storage.setItem(keys.previous, JSON.stringify(original)); }
        catch (error) { throw new Error(`이전 설정 복구 사본을 저장하지 못했습니다 [${error.name || 'Error'}]. 현재 설정은 바꾸지 않았습니다.`); }
        try {
          if (options !== null) write('options', nextOptions);
          write('library', nextLibrary);
        } catch (error) { throw failure('설정 가져오기', error, rollback(original)); }
        return {library, options};
      },
      undo() {
        const target = previous(), original = snapshot();
        try { write('options', target.options); write('library', target.library); }
        catch (error) { throw failure('이전 설정 복원', error, rollback(original)); }
        return true;
      },
      hasPrevious() {
        try { previous(); return true; } catch { return false; }
      }
    };
  }
  async function readLoraTriggerWords(lora, io = {}) {
    const id=presetIdentifier(lora.id,'LoRA',true), versionId=presetIdentifier(lora.versionId,'LoRA 버전',true);
    const url=`https://pixai.art/en/model/${id}/${versionId}`;
    const controller=new (io.AbortController || AbortController)();
    const timer=(io.setTimeout || setTimeout)(()=>controller.abort(),8000);
    try {
      // Public model-page HTML only. No account cookies, API tokens or generation requests.
      const response=await (io.fetch || fetch)(url,{credentials:'omit',redirect:'error',signal:controller.signal});
      if (!response.ok || response.url !== url || !response.headers.get('content-type')?.includes('text/html')) throw new Error('LoRA 공개 상세 페이지를 읽지 못했습니다.');
      const html=await response.text();
      const doc=io.parseHtml ? io.parseHtml(html) : new DOMParser().parseFromString(html,'text/html');
      const canonicalHref=doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();
      if (!canonicalHref) throw new Error('LoRA 상세 페이지의 모델 정보를 확인하지 못했습니다.');
      const canonical=new URL(canonicalHref,url);
      if (canonical.origin !== 'https://pixai.art' || !new RegExp(`^/en/model/${id}(?:/${versionId})?/?$`).test(canonical.pathname)) throw new Error('LoRA 상세 페이지의 모델이 다릅니다.');
      const terms=[...doc.querySelectorAll('dt')].filter(e=>e.textContent.trim()==='Trigger Words');
      const value=terms.length === 1 ? terms[0].nextElementSibling : null;
      if (value?.tagName !== 'DD' || value.querySelector('script,style')) throw new Error('LoRA 트리거 항목을 확인하지 못했습니다.');
      const paragraphs=[...value.querySelectorAll('p')];
      return presetText(paragraphs.length ? paragraphs.map(e=>e.textContent.trim()).filter(Boolean).join(', ') : value.textContent);
    } finally { (io.clearTimeout || clearTimeout)(timer); }
  }
  async function capturePresetSettings(adapter, readTriggers) {
    const config=await adapter.capture(), triggerWarnings=[];
    const loras=await Promise.all(config.loras.map(async lora=>{
      try { const triggerWords=await readTriggers(lora); return {...lora,...(triggerWords ? {triggerWords} : {})}; }
      catch { triggerWarnings.push(lora.name || lora.id); return lora; }
    }));
    // Do not mix settings from before and after a user edit while the pages load.
    assertConfiguration(config,await adapter.capture());
    return {...config,loras,triggerWarnings};
  }
  // This adapter only uses visible site controls. It never submits or accesses React state.
  function createPixaiSettingsAdapter(doc, io) {
    const shown = e => {
      if (!e || !e.getClientRects().length) return false;
      for (let current=e; current; current=current.parentElement) {
        if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true') return false;
        const style=io.win.getComputedStyle?.(current);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
      }
      return true;
    };
    const list = (scope, selector) => [...scope.querySelectorAll(selector)];
    const labels={ '전체 모델 보기':['전체 모델 보기','See All Models'], '전체 LoRA 보기':['전체 LoRA 보기','See All LoRAs'], '이 모델 사용':['이 모델 사용','Use this model','Use This Model'], '확인':['확인','Confirm','Confirm selection'], '고급':['고급','Advanced'] };
    const matchesText=(element,text)=>(labels[text] || [text]).includes(element.textContent.trim());
    const buttons = (scope, text) => list(scope,'button').filter(e => shown(e) && matchesText(e,text));
    const mainButtons = text => list(doc,'main button').filter(e => shown(e) && matchesText(e,text));
    function only(items, label) {
      if (items.length !== 1) throw new Error(`${label}을 하나로 확인할 수 없습니다. PixAI 한국어 새 에디터를 확인해 주세요.`);
      return items[0];
    }
    function click(e) { io.check(); if (!e || e.disabled) throw new Error('설정 버튼을 사용할 수 없습니다.'); io.mutate(() => e.click()); }
    async function waitFor(get, label) {
      for (let count=0; count<100; count++) { io.check(); const result=get(); if (result) return result; await io.sleep(200); }
      throw new Error(`${label} 확인 시간 초과. 생성하지 않았습니다.`);
    }
    function dialog() {
      const found = list(doc,'[role="dialog"]').filter(shown);
      return found.length === 1 ? found[0] : null;
    }
    async function revealModelPanel() {
      const tabs=list(doc,'main [role="tab"]').filter(e=>shown(e)&&['모델','Model'].includes(e.textContent.trim()));
      if (tabs.length === 1 && tabs[0].getAttribute('aria-selected') !== 'true') click(tabs[0]);
      await waitFor(()=>modelLinks().length > 0,'선택 모델 카드');
    }
    function namedVersionLinks(scope) {
      const links=list(scope,'a[href*="/model/"]').filter(e=>shown(e)&&e.textContent.trim()&&parseModelLink(e.getAttribute('href')));
      return [...new Map(links.map(link=>{
        const model=parseModelLink(link.getAttribute('href'));
        return [`${model.id}/${model.versionId}`,link];
      })).values()];
    }
    const selectedCards = section => list(doc,`main [data-section="${section}"] [data-testid="selected-entity-card"]`).filter(shown);
    function loraRows() {
      const rows=selectedCards('styles');
      // LoRA cards do not always expose the shared card test ID. Resolve their
      // number field inside the styles section, never in model/settings/history.
      for (const section of list(doc,'main [data-section="styles"]').filter(shown)) {
        for (const input of list(section,'input[type="number"]').filter(shown)) {
          if (rows.some(row=>row.contains(input))) continue;
          let row=input.parentElement;
          while (row && row!==section && !namedVersionLinks(row).length) row=row.parentElement;
          if (!row || row===section) throw new Error('선택 LoRA 행을 확인할 수 없습니다.');
          rows.push(row);
        }
      }
      return rows.map(row=>{
        const input=only(list(row,'input[type="number"]').filter(shown),'선택 LoRA 가중치 입력창');
        const link=only(namedVersionLinks(row),'선택 LoRA 버전');
        const model=parseModelLink(link?.getAttribute('href'));
        if (!model) throw new Error('선택 LoRA 버전을 확인할 수 없습니다.');
        return {row,input,...model,name:link.textContent.trim(),weight:Number(input.value)};
      });
    }
    function modelLinks() {
      const links=selectedCards('model').flatMap(namedVersionLinks);
      return [...new Map(links.map(link=>{
        const model=parseModelLink(link.getAttribute('href'));
        return [`${model.id}/${model.versionId}`,link];
      })).values()];
    }
    function modelKey() {
      const model=parseModelLink(only(modelLinks(),'현재 모델 버전').getAttribute('href'));
      return `${model.id}/${model.versionId}`;
    }
    function read(allowIncompatible = false) {
      const loras=loraRows(), links=modelLinks();
      const link=only(links,'현재 모델 버전');
      const config=validatePresetConfiguration({model:{...parseModelLink(link.getAttribute('href')),name:link.textContent.trim()},loras:loras.map(({id,versionId,name,weight})=>({id,versionId,name,weight}))});
      if (!allowIncompatible && loras.some(item=>item.row.querySelector('[class*="text-danger"]'))) throw new Error('호환되지 않거나 사용할 수 없는 LoRA가 표시돼 있습니다.');
      return config;
    }
    function fill(input, value) {
      io.check();
      if (input.disabled || input.readOnly) throw new Error('설정 입력창을 사용할 수 없습니다.');
      io.mutate(()=>{
        const proto = input.tagName === 'TEXTAREA' ? io.win.HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? io.win.HTMLSelectElement.prototype : io.win.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
        if (!setter) throw new Error('사이트 입력값을 적용할 수 없습니다.');
        setter.call(input,String(value));
        input.dispatchEvent(new io.win.Event('input',{bubbles:true}));
        input.dispatchEvent(new io.win.Event('change',{bubbles:true}));
        input.blur();
      });
    }
    function labelById(scope, id, type) {
      return list(scope,'label').filter(label=>shown(label)&&label.querySelector(`input[type="${type}"]`)&&list(label,'a[href*="/model/"]').some(a=>new RegExp(`/model/${id}(?:/|$)`).test(a.getAttribute('href'))));
    }
    async function selectCard(d, item, type) {
      let found=labelById(d,item.id,type);
      if (!found.length) {
        const search=only(list(d,'input[type="search"]'),'모델 검색창');
        fill(search,item.name || item.id);
        found=await waitFor(()=>{const matches=labelById(d,item.id,type);return matches.length?matches:null},`모델 ${item.name || item.id}`);
      }
      const label=only(found,'선택할 모델 카드');
      click(label.querySelector(`input[type="${type}"]`));
      return label.getAttribute('title') || item.name;
    }
    async function applyModel(model) {
      const current=read(true).model;
      if (current.id === model.id && current.versionId === model.versionId) return;
      click(only(mainButtons('전체 모델 보기'),'전체 모델 보기 버튼'));
      const d=await waitFor(dialog,'모델 선택창');
      const selectedName=await selectCard(d,model,'radio');
      await waitFor(()=>buttons(d,'이 모델 사용').length === 1 && (!selectedName || buttons(d,selectedName).length > 0),'모델 상세');
      // Multi-version dialogs expose version IDs as select options; otherwise the
      // site's default version is used and must match the exact saved ID below.
      const versionSelect=list(d,'select').find(select=>list(select,'option').some(o=>o.value === model.versionId));
      if (versionSelect) fill(versionSelect,model.versionId);
      click(only(buttons(d,'이 모델 사용'),'모델 적용 버튼'));
      await waitFor(()=>!dialog(),'모델 선택창 닫힘');
      await waitFor(()=>{try{return read(true).model.id === model.id}catch{return false}},'모델 적용');
      const selected=read(true).model;
      if (selected.versionId !== model.versionId) throw new Error('이 모델의 저장한 버전을 자동 선택하지 못했습니다. 사이트에서 해당 버전을 선택한 뒤 다시 시도해 주세요.');
    }
    async function applyLoras(config) {
      // Removing extras first makes account LoRA slot limits predictable.
      for (const selected of loraRows()) {
        const target=config.loras.find(item=>item.id === selected.id);
        if (!target || (target.versionId && target.versionId !== selected.versionId)) {
          const remove=list(selected.row,'button').filter(e=>shown(e)&&['제거','Remove'].includes(e.getAttribute('aria-label')));
          click(only(remove,'LoRA 제거 버튼'));
          await waitFor(()=>!loraRows().some(item=>item.id === selected.id),'LoRA 제외');
        }
      }
      for (const target of config.loras) {
        if (!loraRows().some(item=>item.id === target.id)) {
          click(only(mainButtons('전체 LoRA 보기'),'전체 LoRA 보기 버튼'));
          const d=await waitFor(dialog,'LoRA 선택창');
          await selectCard(d,target,'checkbox');
          await waitFor(()=>!!d.querySelector(`[id="weight-slider-${target.id}"]`),'LoRA 선택');
          click(only(buttons(d,'확인'),'LoRA 확인 버튼'));
          await waitFor(()=>!dialog(),'LoRA 선택창 닫힘');
          await waitFor(()=>loraRows().some(item=>item.id===target.id),'LoRA 반영');
        }
        const selected=loraRows().find(item=>item.id === target.id);
        if (target.versionId && selected.versionId !== target.versionId) throw new Error(`LoRA ${target.name || target.id}의 저장한 버전을 선택하지 못했습니다. 사이트에서 버전을 선택해 주세요.`);
        assertNumberField(selected.input,target.weight);
        fill(selected.input,target.weight);
        await waitFor(()=>Math.abs(loraRows().find(item=>item.id===target.id)?.weight-target.weight)<0.000001,'LoRA 수치 반영');
      }
    }
    async function capture() {
      io.check();
      if (dialog()) throw new Error('열린 사이트 선택창을 먼저 닫아 주세요.');
      await revealModelPanel();
      return read();
    }
    async function apply(value) {
      const config=validatePresetConfiguration(value);
      if (dialog()) throw new Error('열린 사이트 선택창을 먼저 닫아 주세요.');
      await revealModelPanel();
      const imageCount=readImageCount(true);
      try { await applyModel(config.model); await applyLoras(config); if (imageCount!=null) await setImageCount(imageCount); return assertConfiguration(config,read()); }
      catch(error) {
        const d=dialog(), close=d?.querySelector('button[aria-label="닫기"]') || d?.querySelector('button[aria-label="Close"]');
        if (close) { try { io.mutate(()=>close.click()); } catch {} }
        throw error;
      }
    }
    function negativeField() { return list(doc,'main textarea').filter(e=>shown(e)&&['여기에 네거티브 프롬프트를 입력하세요','Enter negative prompt here'].includes(e.getAttribute('placeholder')))[0]; }
    async function captureNegative() {
      let input=negativeField();
      if (!input) {
        const advanced=mainButtons('고급');
        if (advanced.length === 1 && advanced[0].getAttribute('aria-expanded') !== 'true') { click(advanced[0]); await io.sleep(200); }
        input=negativeField();
      }
      return input ? input.value : '';
    }
    async function setNegative(value) {
      await captureNegative();
      const input=negativeField();
      if (!input) { if (normalize(value)) throw new Error('현재 모델에는 네거티브 입력창이 없습니다. 네거티브를 비우거나 지원 모델을 사용해 주세요.'); return; }
      fill(input,value);
      await waitFor(()=>normalize(negativeField()?.value) === normalize(value),'네거티브 반영');
    }
    function verifyNegative(value) {
      const input=negativeField();
      if ((input && normalize(input.value) !== normalize(value)) || (!input && normalize(value))) throw new Error('네거티브 프롬프트가 조합과 다릅니다. 생성하지 않습니다.');
    }
    function imageControls(optional=false) {
      const groups=list(doc,'main [role="group"]').filter(e=>shown(e)&&['이미지 수','Number of images'].includes((e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>doc.getElementById(id)?.textContent || '').join(' ')).trim()));
      if (optional && !groups.length) return [];
      const group=only(groups,'이미지 수 선택');
      return [...new Set([...list(group,'[role="radio"]'),...list(group,'input[type="radio"]')])].filter(shown).map(element=>{
        const text=element.getAttribute('aria-label') || element.textContent || element.closest?.('label')?.textContent || '';
        return {element,count:/x4|×4/i.test(text) ? 4 : /단일|single/i.test(text) ? 1 : null};
      }).filter(item=>item.count);
    }
    function readImageCount(optional=false) {
      const controls=imageControls(optional);
      if (optional && !controls.length) return null;
      const selected=only(controls.filter(({element})=>element.checked || element.getAttribute('aria-checked')==='true'),'선택한 이미지 수');
      return selected.count;
    }
    async function setImageCount(count) {
      if (![1,4].includes(count)) throw new Error('생성당 이미지 수는 1장 또는 4장이어야 합니다.');
      if (readImageCount()===count) return;
      click(only(imageControls().filter(item=>item.count===count),'이미지 수 버튼').element);
      await waitFor(()=>readImageCount()===count,'이미지 수 반영');
    }
    return {capture,apply,read,modelKey,revealModelPanel,setNegative,verifyNegative,captureNegative,readImageCount,setImageCount};
  }

function mountPresetEditor(parent, io) {
  const copy = value => JSON.parse(JSON.stringify(value));
  let library = normalizePresetLibrary(io.load() || makePresetLibrary());
  const root = document.createElement('div'); root.className = 'pq-presets';
  const runtimePages = []; // 대기열·설정 페이지: 실행 중 잠금 대상
  const pickerRenderers=new Map();
  function el(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [name,value] of Object.entries(attrs)) element.setAttribute(name,value);
    return element;
  }
  function action(text, run) {
    const element = io.button(text, run); element.dataset.edit = '';
    const icon=text.includes('삭제') || text.includes('제외') ? 'delete' : text.includes('복제') ? 'content_copy' : text.includes('폴더') ? 'create_new_folder' : text.includes('저장') ? 'save' : text.includes('해제') || text.includes('취소') ? 'close' : text.includes('예약') || text.includes('등록') ? 'playlist_add' : text.includes('이동') ? 'folder_open' : text.includes('읽기') ? 'download' : text.includes('새 ') || text.includes('추가') ? 'add' : null;
    if (icon) decorateIcon(element,icon);
    if (text.endsWith(' 저장') || text === '이 조합 예약 추가' || text === '예약 전부를 대기열에 등록') element.dataset.primary = '';
    if (io.isBusy?.()) element.disabled=true;
    return element;
  }
  // Buttons that read or change the PixAI page stay locked while this tab's runner drives the page.
  function siteAction(text, run) { const element = action(text, run); element.setAttribute('data-site-io', ''); return element; }
  function field(label, tag = 'input', attrs = {}) {
    const input = el(tag,null,{'data-edit':'','aria-label':label,...attrs});
    const wrap = el('label',attrs.type==='checkbox'?null:label);if(attrs.type==='checkbox'){wrap.className='pq-check-label';wrap.append(input,el('span',label));}else wrap.append(input);return {input,wrap};
  }
  const navigation = el('div',null,{class:'pq-tabs',role:'tablist','aria-label':'PixAI 작업 화면'});
  const pages = el('div',null,{class:'pq-pages'}), views = [];
  const libraryIds=['chunks','characters','presets','common'];
  let libraryPage=null,libraryTab='chunks',parityUI=null;
  root.append(navigation,pages);
  function showPage(id,focus=false,bypass=false) {
    if(!bypass&&parityUI?.requestNavigation(id,()=>showPage(id,focus,true)))return;
    const view=views.find(item=>item.id===id);if (!view) return;
    if (libraryIds.includes(id)) libraryTab=id;
    const mainId=libraryPage && libraryIds.includes(id) ? 'library' : id;
    for (const item of views) {
      const selected=libraryPage && libraryIds.includes(item.id) ? mainId==='library' && item.id===libraryTab : item.id===mainId;
      item.body.hidden=!selected;
      item.tab.setAttribute('aria-selected',String(selected));item.tab.setAttribute('tabindex',selected ? '0' : '-1');
    }
    if (focus) {view.tab.focus({preventScroll:true});view.tab.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'});}
    const registration=root.querySelector('.pq-registration-bar');if (registration) registration.hidden=mainId!=='compose';
  }
  function buttonPicker(control,{icon='folder',caption=null,empty=true,onChange=()=>{},editable=true,groups=null}={}) {
    control.wrap.hidden=true;
    const wrap=el('div',null,{class:'pq-button-picker'}),label=control.input.getAttribute('aria-label');
    const list=el('div',null,{class:'pq-choice-list','aria-label':`${label} 버튼 목록`});wrap.append(el('strong',caption || label),list);
    const opened=new Set(['']);
    function render() {
      const focused=document.activeElement?.dataset.choiceValue;list.replaceChildren();
      const options=[...control.input.children].filter(option=>empty || option.value || control.input.children.length===1);
      function addOption(option,parent) {
        const button=el('button',option.textContent,{type:'button','aria-label':`${label}: ${option.textContent}`,'aria-pressed':String(control.input.value===option.value),'data-choice-value':option.value});
        decorateIcon(button,icon);if(label==='조합 이미지 비율'&&API_RATIOS.includes(option.value))button.replaceChildren(ratioMark(el,option.value),el('span',option.value+' · '+ratioDescription(option.value)));if (editable) {button.dataset.edit='';button.disabled=!!io.isBusy?.();}if (!empty && !option.value) {button.dataset.unavailable='true';button.disabled=true;}
        button.addEventListener('click',()=>{if (editable && io.isBusy?.()) return;control.input.value=option.value;onChange(option.value);render();[...list.querySelectorAll('[data-choice-value]')].find(item=>item.dataset.choiceValue===option.value)?.focus({preventScroll:true});});parent.append(button);
      }
      if (groups) for (const group of groups()) {
        const members=options.filter(option=>group.ids.includes(option.value));if (!members.length) continue;
        const details=el('details',null,{class:'pq-folder-group','data-character-picker-folder':group.id});details.open=opened.has(group.id);
        const selected=members.find(option=>option.value===control.input.value),summary=el('summary',`${group.name} · ${members.length}개${selected ? ` · ${selected.textContent}` : ''}`);
        details.append(summary);details.addEventListener('toggle',()=>{if (details.open) opened.add(group.id);else opened.delete(group.id);});
        for (const option of members) addOption(option,details);list.append(details);
      } else for (const option of options) addOption(option,list);
      if (focused!==undefined && list.contains(document.activeElement)) [...list.querySelectorAll('[data-choice-value]')].find(item=>item.dataset.choiceValue===focused)?.focus({preventScroll:true});
    }
    pickerRenderers.set(control.input,render);control.input.addEventListener('change',render);wrap.append(control.wrap);
    return {wrap,list,render};
  }
  function quickFolder(picker,label,onCreate,moving=false) {
    const create=el('div',null,{class:'pq-quick-folder'}),name=field(`${label} 새 폴더 이름`,'input',{placeholder:'새 폴더 이름'}),form=el('div',null,{class:'pq-quick-folder-form'});form.hidden=true;
    const open=action('새 폴더',()=>{form.hidden=false;name.input.focus();});open.setAttribute('aria-label',`${label} 새 폴더`);open.dataset.headerFeedback='';
    async function saveFolder() {await onCreate(nameValue(name.input));form.hidden=true;name.input.value='';picker.render();[...picker.list.children].find(item=>item.getAttribute('aria-pressed')==='true')?.focus({preventScroll:true});}
    const save=action(moving ? (label.startsWith('캐릭터') ? '만들고 선택 캐릭터 이동' : '만들고 선택 청크 이동') : (label.startsWith('캐릭터') ? '만들고 캐릭터 폴더 선택' : '만들고 폴더 선택'),saveFolder);save.dataset.headerFeedback='';
    const cancel=action('취소',()=>{form.hidden=true;name.input.value='';open.focus();});cancel.setAttribute('aria-label',`${label} 폴더 만들기 취소`);cancel.dataset.headerFeedback='';
    name.input.addEventListener('keydown',async event=>{if (event.key!=='Enter' || event.isTrusted===false || io.isBusy?.()) return;event.preventDefault();try {await saveFolder();}catch(error){io.notify(error.message);}});
    const actions=el('div',null,{class:'pq-actions'});actions.append(save,cancel);form.append(name.wrap,actions);create.append(open,form);picker.wrap.append(create);
    return ()=>{form.hidden=true;name.input.value='';};
  }
  function resizable(layout,panes,key,initial,minimums) {
    layout.className+=' pq-resizable-layout';layout.dataset.layoutKey=key;
    bindPaneResize(layout,panes,{initial,minimums,load:()=>io.loadLayout?.(key),save:value=>io.saveLayout?.(key,value),enabled:()=>!io.isCompact?.(),
      createHandle:index=>el('div',null,{class:'pq-pane-handle',role:'separator',tabindex:'0','aria-orientation':'vertical','aria-label':`${key} 영역 ${index+1} 너비 조절`,'aria-valuemin':'0','aria-valuemax':'100',title:'드래그해 비율 조절 · ←→ 키 · 두 번 클릭하면 기본 비율'})});
  }
  function section(title, open = false, id = ['common','presets','characters','chunks','compose'][views.length] || title) {
    const label={common:'공통문',presets:'모델·LoRA',characters:'캐릭터',chunks:'청크',compose:'조합 예약'}[id] || title;
    const body=el('div',null,{class:'pq-preset-body',role:'tabpanel',id:`pq-page-${id}`,'aria-labelledby':`pq-tab-${id}`,'data-page':id});
    const tab=el('button',label,{type:'button',role:'tab',id:`pq-tab-${id}`,'aria-controls':body.id});decorateIcon(tab,({compose:'playlist_add',chunks:'layers',characters:'person',presets:'tune',common:'view_module',studio:'view_module','image-info':'upload',queue:'play_arrow',settings:'settings'})[id]);
    tab.addEventListener('click',()=>showPage(id));
    tab.addEventListener('keydown',event=>{
      const peers=views.filter(item=>libraryIds.includes(item.id)===libraryIds.includes(id));
      const order=libraryIds.includes(id) ? libraryIds : ['compose','library','studio','image-info','queue','settings'];peers.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
      const index=peers.findIndex(item=>item.id===id);
      const next=event.key==='ArrowRight' ? (index+1)%peers.length : event.key==='ArrowLeft' ? (index+peers.length-1)%peers.length : event.key==='Home' ? 0 : event.key==='End' ? peers.length-1 : -1;
      if (next<0) return;event.preventDefault();showPage(peers[next].id,true);
    });
    views.push({id,body,tab});navigation.append(tab);pages.append(body);
    showPage(open ? id : views.find(item=>!item.body.hidden)?.id || id);return body;
  }
  function selectOptions(select, items, caption, selected, first = false) {
    select.replaceChildren(el('option',caption,{value:''}));
    for (const item of items) select.append(el('option',item.name,{value:item.id}));
    select.value = items.some(item => item.id === selected) ? selected : (first ? items[0]?.id || '' : '');
    pickerRenderers.get(select)?.();
  }
  async function commit(next, message) {
    const normalized = normalizePresetLibrary(next);
    await io.save(copy(normalized),copy(library)); library = normalized;
    refreshLists(); renderReservations(); preview();parityUI?.refresh();
    if (message) io.notify(message);
  }
  const orderRefreshers = [];
  let libraryDrag=null,libraryDropBusy=false;
  function libraryOrderHandle(row,key,item,label) {
    row.dataset.libraryReorder=key;
    row.dataset.libraryItem=item.id;
    const handle=el('button',null,{type:'button',draggable:'true',class:'pq-drag-handle','data-edit':'','aria-label':`${label} 이동: ${item.name}`,title:'드래그해서 목록 순서 변경'});
    decorateIcon(handle,'drag_indicator');
    const type='application/x-pixai-library-item';
    const clear=()=>{libraryDrag=null;for (const target of root.querySelectorAll('[data-library-reorder]')) target.dataset.dropPosition='';};
    handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
    handle.addEventListener('dragstart',event=>{
      if (event.isTrusted===false || libraryDropBusy || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}
      event.stopPropagation();libraryDrag={key,id:item.id};event.dataTransfer.setData(type,JSON.stringify(libraryDrag));event.dataTransfer.effectAllowed='move';event.dataTransfer.setDragImage?.(row,12,12);
    });
    handle.addEventListener('dragend',clear);
    const accepts=event=>event.isTrusted!==false && !libraryDropBusy && !io.isBusy?.() && libraryDrag?.key===key && libraryDrag.id!==item.id;
    row.addEventListener('dragover',event=>{
      if (!accepts(event)) return;
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
      row.dataset.dropPosition=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2 ? 'after' : 'before';
    });
    row.addEventListener('dragleave',event=>{if (!row.contains(event.relatedTarget)) row.dataset.dropPosition='';});
    row.addEventListener('drop',async event=>{
      if (!accepts(event) || event.dataTransfer?.getData(type)!==JSON.stringify(libraryDrag)) return;
      event.preventDefault();event.stopPropagation();const dragged=libraryDrag;
      const after=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;
      clear();libraryDropBusy=true;
      try {await commit(placeLibraryItem(library,key,dragged.id,item.id,after),'목록 순서를 변경했습니다.');}
      catch(error) {io.notify(error.message);}
      finally {libraryDropBusy=false;}
    });
    handle.disabled=!!io.isBusy?.();return handle;
  }
  function available(control, value) {
    control.dataset.unavailable = String(!value); control.disabled = !value || !!io.isBusy?.();
  }
  function orderControls(key, currentId, label, persistent = true, compact = false) {
    const wrap = el('div',null,{class:'pq-actions'});
    const buttons = [-1,1].map(direction => {
      const word = direction < 0 ? '위로' : '아래로';
      const button = action(compact ? (direction < 0 ? '↑' : '↓') : word,async () => {
        const id = currentId();
        if (!library[key].some(item=>item.id===id)) throw new Error('순서를 바꿀 저장 항목을 선택해 주세요.');
        await commit(moveLibraryItem(library,key,id,direction),'목록 순서를 변경했습니다. 기존 예약의 청크 순서는 유지됩니다.');
        const controls=[...root.querySelectorAll('[data-order-key]')].filter(control=>control.dataset.orderKey===key&&control.dataset.orderId===id&&control.dataset.orderContext===(persistent ? 'editor' : 'row')&&!control.disabled);
        (controls.find(control=>control.dataset.direction===String(direction)) || controls[0])?.focus({preventScroll:true});
      });
      button.setAttribute('aria-label',`${label} ${word}`); button.title=`${label} ${word}`;
      button.dataset.orderContext=persistent ? 'editor' : 'row';
      wrap.append(button); return button;
    });
    function refresh() {
      const id=currentId(),current=library[key].find(item=>item.id===id);
      const items=['scenes','characters'].includes(key) ? library[key].filter(item=>item.folderId===current?.folderId) : library[key];
      const index=items.findIndex(item=>item.id===id);
      for (let i=0;i<buttons.length;i++) Object.assign(buttons[i].dataset,{orderKey:key,orderId:id || '',direction:String(i===0 ? -1 : 1)});
      available(buttons[0],index>0);available(buttons[1],index>=0&&index<items.length-1);
    }
    if (persistent) orderRefreshers.push(refresh);
    refresh(); return wrap;
  }
  const chunkGroups = () => [{id:'',name:'미분류'},...library.chunkFolders];
  root.append(el('style','#local-pixai-queue .pq-library-order-row{display:flex;align-items:center;gap:7px}#local-pixai-queue .pq-library-order-row>.pq-saved-card{flex:1;min-width:0}#local-pixai-queue [data-library-reorder]>.pq-drag-handle{flex:none;width:24px;min-height:28px;padding:0;border:0;background:transparent;cursor:grab}#local-pixai-queue .pq-folder-group>summary>.pq-drag-handle{float:none;vertical-align:middle;margin:0 6px 0 0}#local-pixai-queue .pq-folder-group>summary[data-library-reorder]>.pq-folder-title{max-width:calc(100% - 80px)}#local-pixai-queue [data-library-reorder][data-drop-position="before"]{box-shadow:inset 0 3px var(--pq-accent,#acd1ed)}#local-pixai-queue [data-library-reorder][data-drop-position="after"]{box-shadow:inset 0 -3px var(--pq-accent,#acd1ed)}'));
  const matchesChunk = (chunk,text) => `${chunk.name}\n${chunk.prompt}\n${chunk.negativePrompt}`.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase());
  function filterChunks(search,filter) {
    return orderedChunks(library).filter(chunk=>matchesChunk(chunk,search)&&(!filter || (filter==='unfiled' ? !chunk.folderId : `folder:${chunk.folderId}`===filter)));
  }
  function folderFilterOptions(select) {
    const selected=select.value;
    selectOptions(select,[{id:'unfiled',name:'미분류'},...library.chunkFolders.map(folder=>({id:`folder:${folder.id}`,name:folder.name}))],'모든 폴더',selected);
  }
  function nameValue(input) {
    const value = input.value.trim();
    if (!value) throw new Error('저장할 이름을 입력해 주세요.');
    return value;
  }
  function repeatValue(input) {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('생성 횟수는 1~100의 정수로 입력해 주세요.');
    return value;
  }
  root.append(el('style', '.pq-presets details{border-top:1px solid #41474f;margin-top:8px}.pq-presets summary{padding:8px 0;cursor:pointer;font-weight:600}.pq-presets .pq-preset-body{padding-bottom:7px}.pq-presets label{display:block;margin:6px 0;font-size:13px}.pq-presets select{display:block;width:100%;padding:8px;border:1px solid #4a515a;border-radius:7px;background:#151719;color:inherit;font:inherit}.pq-presets textarea{min-height:68px}.pq-presets .pq-lora,.pq-presets .pq-reservation{border:1px solid #41474f;border-radius:8px;padding:8px;margin:6px 0}.pq-presets .pq-inline{display:flex;gap:7px}.pq-presets .pq-inline>*{flex:1;min-width:0}.pq-presets .pq-reservation label{max-width:130px}.pq-presets .pq-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:125px;overflow:auto;border-left:2px solid #627d91;padding-left:8px;margin:8px 0;color:#d0d7df}.pq-presets button{font-size:13px}'));
  root.append(el('style','#local-pixai-queue .pq-chunk-list{max-height:210px;overflow:auto;border:1px solid #41474f;border-radius:8px;margin:6px 0}#local-pixai-queue .pq-chunk-option{display:flex;align-items:flex-start;gap:8px;margin:0;padding:8px;cursor:pointer;border-bottom:1px solid #41474f}#local-pixai-queue .pq-chunk-option:last-child{border-bottom:0}#local-pixai-queue .pq-chunk-option input[type="checkbox"]{width:auto;flex:0 0 auto;margin:3px 0;padding:0;accent-color:#94bedf}#local-pixai-queue .pq-chunk-option>span{min-width:0;flex:1}#local-pixai-queue .pq-chunk-option small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}'));
  root.append(el('style','#local-pixai-queue .pq-presets .pq-actions{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}#local-pixai-queue .pq-presets .pq-actions button{margin:0;padding:6px 9px;min-height:32px}#local-pixai-queue .pq-presets .pq-manager-row{padding:8px;border-top:1px solid #41474f}#local-pixai-queue .pq-presets .pq-manager-row[data-selected="true"]{background:#30363c;border-left:3px solid #94bedf}#local-pixai-queue .pq-presets .pq-manager-row strong{display:block;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-manager-row small{max-height:42px;overflow:hidden;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-folder-group{margin:0;border:0}#local-pixai-queue .pq-presets .pq-folder-group summary{padding:8px;background:#29343d;font-size:13px;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-selected-chunks{padding:8px 10px;border:1px solid #627d91;border-radius:8px;background:#29343d;overflow-wrap:anywhere;font-size:13px}#local-pixai-queue .pq-presets .pq-selected-chunks small{margin-top:3px}#local-pixai-queue .pq-presets .pq-empty{padding:10px;color:#bbc3cc}#local-pixai-queue .pq-presets button[data-unavailable="true"]{opacity:.45;cursor:default}#local-pixai-queue .pq-presets .pq-chunk-list:empty{display:none}'));
  root.append(el('style','#local-pixai-queue .pq-presets .pq-chunk-row-head{display:flex;align-items:center;gap:6px}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;padding:3px 0;border:0;background:transparent;font-weight:600;font-size:13px}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions{flex:none;margin:0}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions button{width:30px;padding:4px;min-height:30px}#local-pixai-queue .pq-presets .pq-manager-row small{white-space:nowrap;text-overflow:ellipsis;max-height:21px}'));
  // Each screen keeps its DOM and draft when another tab is selected.

  const commonBody = section('① 공통 프롬프트');
  const commonPrompt = field('공통 프롬프트','textarea');
  const commonNegative = field('공통 네거티브','textarea');
  commonPrompt.input.value = library.common.prompt || '';
  commonNegative.input.value = library.common.negativePrompt || '';
  commonBody.append(commonPrompt.wrap,commonNegative.wrap,action('공통문 저장',async () => {
    const next = copy(library);
    next.common = {prompt:commonPrompt.input.value.trim(),negativePrompt:commonNegative.input.value.trim()};
    await commit(next,'공통 프롬프트를 저장했습니다.');
  }));

  const presetBody = section('② 모델 · LoRA 프리셋');
  const presetSelect = field('저장한 설정 프리셋','select');
  const presetName = field('프리셋 이름');
  const presetPrompt=field('프리셋 포지','textarea'),presetNegative=field('프리셋 네거','textarea'),presetCommon=field('연결할 공통문','select');
  const presetCommonPicker=buttonPicker(presetCommon,{caption:'적용 공통문'});
  function refreshCommonChoices(value=presetCommon.input.value){presetCommon.input.replaceChildren(el('option','기본 공통문',{value:''}),...(library.commonPresets||[]).map(item=>el('option',item.name,{value:item.id})));if(value&&!library.commonPresets?.some(v=>v.id===value))presetCommon.input.append(el('option','(삭제된 세트) · 연결 확인 필요',{value}));presetCommon.input.value=value;presetCommonPicker.render();}
  const modelId = field('모델 ID');
  const modelVersionId = field('모델 버전 ID','input',{inputmode:'numeric'});
  const modelName = field('모델 이름');
  const modelFamily = field('모델 계열 (선택)');
  const loraList = el('div');
  let loraRows = [];
  let presetOpen=false;
  let renderPresetList = () => {};
  function addLora(value = {}) {
    const row = el('div',null,{class:'pq-lora'});
    const id = field('LoRA ID'); id.input.value = value.id || '';
    const versionId = field('LoRA 버전 ID (선택)','input',{inputmode:'numeric'}); versionId.input.value = value.versionId || '';
    const name = field('LoRA 이름'); name.input.value = value.name || '';
    const weight = field('LoRA 가중치','input',{type:'number',step:'0.1'});
    weight.input.value = value.weight ?? 1;
    const triggerWords = field('LoRA 트리거 키워드','textarea',{placeholder:'예: character_name, special_outfit'});
    triggerWords.input.value = value.triggerWords || '';
    const controls = {row,id:id.input,versionId:versionId.input,name:name.input,weight:weight.input,triggerWords:triggerWords.input};
    loraRows.push(controls);
    const identity=el('details');identity.append(el('summary','LoRA ID 직접 편집'),id.wrap,versionId.wrap);
    row.append(name.wrap,weight.wrap,triggerWords.wrap,el('small','설정 읽기에서 공개 트리거를 자동으로 채웁니다. 직접 수정하거나 비워도 됩니다. 저장한 문구가 조합에 붙습니다.'),identity,publicLinkEditor({el,action,field},'LoRA 공개 링크',info=>{id.input.value=info.id;versionId.input.value=info.versionId;name.input.value=info.name;}),action('이 LoRA 제외',() => {
      row.remove(); loraRows = loraRows.filter(item => item !== controls);
    }));
    loraList.append(row);
  }
  function fillPreset(value) {
    presetOpen=true;
    presetName.input.value = value?.name || '';
    presetPrompt.input.value=value?.prompt||'';presetNegative.input.value=value?.negativePrompt||'';refreshCommonChoices(value?.commonPresetId||'');
    modelId.input.value = value?.model?.id || '';
    modelVersionId.input.value = value?.model?.versionId || '';
    modelName.input.value = value?.model?.name || '';
    modelFamily.input.value = value?.model?.family || '';
    loraList.replaceChildren(); loraRows = [];
    for (const lora of value?.loras || []) addLora(lora);
    renderPresetList();
  }
  function readPreset() {
    const id = modelId.input.value.trim();
    if (!id) throw new Error('사이트에서 모델을 선택해 읽어오거나 모델 ID를 입력해 주세요.');
    const versionId = modelVersionId.input.value.trim();
    if (!/^\d+$/.test(versionId)) throw new Error('모델 버전 ID를 숫자로 입력해 주세요. 사이트에서 선택한 설정을 읽어오면 함께 채웁니다.');
    const loras = loraRows.map(item => {
      const loraId = item.id.value.trim();
      const loraVersionId = item.versionId.value.trim();
      const weight = Number(item.weight.value);
      if (!loraId || !item.weight.value.trim() || !Number.isFinite(weight)) throw new Error('각 LoRA의 ID와 숫자 가중치를 입력해 주세요.');
      if (loraVersionId && !/^\d+$/.test(loraVersionId)) throw new Error('LoRA 버전 ID는 숫자로 입력하거나 비워 주세요.');
      const triggerWords = item.triggerWords.value.trim();
      return {id:loraId,...(loraVersionId ? {versionId:loraVersionId} : {}),name:item.name.value.trim(),weight,...(triggerWords ? {triggerWords} : {})};
    });
    if (new Set(loras.map(lora => lora.id)).size !== loras.length) throw new Error('같은 LoRA를 두 번 넣을 수 없습니다.');
    const family = modelFamily.input.value.trim();
    const commonPresetId=presetCommon.input.value;resolvePresetCommon(library,{commonPresetId});
    return {model:{id,versionId,name:modelName.input.value.trim(),...(family ? {family} : {})},loras,...(presetPrompt.input.value||Object.hasOwn(library.presets.find(v=>v.id===presetSelect.input.value)||{},'prompt')?{prompt:presetPrompt.input.value}:{}),...(presetNegative.input.value||Object.hasOwn(library.presets.find(v=>v.id===presetSelect.input.value)||{},'negativePrompt')?{negativePrompt:presetNegative.input.value}:{}),...(commonPresetId?{commonPresetId}:{})};
  }
  presetSelect.input.addEventListener('change',() => {fillPreset(library.presets.find(item => item.id === presetSelect.input.value));for (const refresh of orderRefreshers) refresh();});
  const modelIdentity=el('details');modelIdentity.append(el('summary','모델 ID 직접 편집'),modelId.wrap,modelVersionId.wrap,modelFamily.wrap);
  presetBody.append(presetSelect.wrap,presetName.wrap,presetCommonPicker.wrap,presetPrompt.wrap,presetNegative.wrap,
    el('small','PixAI 화면에서 모델·LoRA를 선택한 뒤 읽어오세요. 읽어오기와 설정 확인은 이미지를 생성하지 않습니다.'),
    siteAction('사이트의 현재 설정 읽기',async () => {
      io.notify('현재 모델·LoRA와 공개 트리거를 읽는 중…');
      const triggers = loraRows.map(item=>({id:item.id.value.trim(),versionId:item.versionId.value.trim(),triggerWords:item.triggerWords.value}));
      const settings = await io.captureSettings();
      let autoFilled=0;
      fillPreset({...settings,name:presetName.input.value,prompt:presetPrompt.input.value,negativePrompt:presetNegative.input.value,commonPresetId:presetCommon.input.value,loras:settings.loras.map(lora=>{
        const previous=triggers.find(item=>item.id===lora.id&&(!item.versionId||item.versionId===lora.versionId));
        if (previous?.triggerWords.trim()) return {...lora,triggerWords:previous.triggerWords};
        if (lora.triggerWords) autoFilled++;
        return {...lora,triggerWords:lora.triggerWords || ''};
      })});
      const warning=settings.triggerWarnings?.length ? `\n트리거 자동 읽기 실패: ${settings.triggerWarnings.join(', ')}. 기존 입력은 유지했습니다. 필요하면 직접 입력해 주세요.` : '';
      io.notify(`${settings.model.name || settings.model.id} · LoRA ${settings.loras.length}개를 읽었습니다. 트리거 ${autoFilled}개 자동 입력. 이름을 붙이고 저장해 주세요.${warning}`);
    }),modelName.wrap,modelIdentity,publicLinkEditor({el,action,field},'모델 공개 링크',info=>{modelId.input.value=info.id;modelVersionId.input.value=info.versionId;modelName.input.value=info.name;}),loraList,action('LoRA 추가',() => addLora()));
  if (io.applySettings) presetBody.append(siteAction('화면에 설정 적용 · 생성 안 함',async () => {
    await io.applySettings(readPreset()); io.notify('프리셋을 화면에 적용했습니다. 이미지는 생성하지 않았습니다.');
  }));
  presetBody.append(action('프리셋 저장',async () => {
    const value = {...readPreset(),id:presetSelect.input.value || crypto.randomUUID(),name:nameValue(presetName.input)};
    const next = copy(library); const index = next.presets.findIndex(item => item.id === value.id);
    if (index < 0) next.presets.push(value); else next.presets[index] = value;
    await commit(next,'모델·LoRA 프리셋을 저장했습니다.');
    presetSelect.input.value = value.id;renderPresetList();for (const refresh of orderRefreshers) refresh();
  }),action('새 프리셋',() => {presetSelect.input.value = '';fillPreset(null);for (const refresh of orderRefreshers) refresh();}),action('선택 프리셋 삭제',async () => {
    const id = presetSelect.input.value;
    if (!id) throw new Error('삭제할 저장 프리셋을 선택해 주세요.');
    const next = copy(library); next.presets = next.presets.filter(item => item.id !== id);
    await commit(next,'프리셋을 삭제했습니다. 이미 등록한 대기열은 유지됩니다. 예약은 다른 프리셋으로 다시 추가해 주세요.');
    fillPreset(null);
  }),orderControls('presets',()=>presetSelect.input.value,'선택 프리셋'));

  const presetBrowse=el('div',null,{class:'pq-library-browse'}),presetForm=el('div',null,{class:'pq-library-editor'});
  const presetMode=el('div',null,{class:'pq-library-mode'});presetBody.dataset.libraryMode='browse';
  function showPresetEditor(value) {presetBody.dataset.libraryMode=value;if (value==='edit') {presetOpen=true;renderPresetList();}for (const control of presetMode.children) control.setAttribute('aria-pressed',String(control.dataset.mode===value));}
  for (const [caption,value] of [['목록 보기','browse'],['편집 보기','edit']]) {
    const control=el('button',caption,{type:'button','data-mode':value});control.addEventListener('click',()=>showPresetEditor(value));presetMode.append(control);
  }
  const presetSearch=field('프리셋 검색','input',{type:'search',placeholder:'이름·모델·LoRA 검색'}),presetList=el('div',null,{class:'pq-saved-list','aria-label':'저장한 설정 목록'});
  presetForm.append(...presetBody.children);presetSelect.wrap.hidden=true;
  renderPresetList=()=>{
    presetForm.remove();presetList.replaceChildren();const query=presetSearch.input.value.trim().toLocaleLowerCase();
    const items=library.presets.filter(item=>`${item.name}\n${item.model.name}\n${item.loras.map(lora=>lora.name).join(' ')}`.toLocaleLowerCase().includes(query));
    if (!items.length) presetList.append(el('small','표시할 프리셋이 없습니다. 사이트 설정을 읽어 저장해 주세요.',{class:'pq-empty'}));
    for (const item of items) {
      const selected=presetSelect.input.value===item.id;
      const control=action(item.name,()=>{if (presetSelect.input.value===item.id) {presetOpen=!presetOpen;renderPresetList();} else {presetSelect.input.value=item.id;fillPreset(item);}if (presetOpen) {presetForm.parentElement?.scrollIntoView?.({block:'start'});presetName.input.focus({preventScroll:true});}for (const refresh of orderRefreshers) refresh();});control.dataset.viewOnly='';
      control.className='pq-saved-card';control.setAttribute('aria-label',`프리셋 편집: ${item.name}`);control.setAttribute('aria-expanded',String(selected && presetOpen));control.setAttribute('aria-pressed',String(selected && presetOpen));control.dataset.presetHeading=item.id;
      const heading=el('span',selected && presetOpen ? presetName.input.value || item.name : item.name,{'data-preset-title':item.id});
      control.textContent='';control.append(heading,el('small',`${item.model.name || item.model.id} · 버전 ${item.model.versionId} · ${item.loras.map(lora=>`${lora.name || lora.id} ${lora.weight}`).join(' / ') || 'LoRA 없음'}`));
      const row=el('div',null,{class:'pq-preset-card'}),header=el('div',null,{class:'pq-library-order-row'});
      header.append(libraryOrderHandle(header,'presets',item,'프리셋'),control);row.append(header,previewMaterial(el,presetPreviewText(library,item)));if (selected && presetOpen) row.append(presetForm);presetList.append(row);
    }
    presetForm.hidden=!presetOpen;
    if (!presetForm.parentElement) presetList.append(presetForm);
  };
  presetForm.append(action('프리셋 편집 닫기',()=>{presetOpen=false;renderPresetList();}));
  presetName.input.addEventListener('input',()=>{const title=[...presetList.querySelectorAll('[data-preset-title]')].find(element=>element.dataset.presetTitle===presetSelect.input.value);if (title) title.textContent=presetName.input.value || '이름 없음';});
  presetSearch.input.addEventListener('input',renderPresetList);
  presetBrowse.append(presetSearch.wrap,presetList,action('새 프리셋 만들기',()=>{presetSelect.input.value='';fillPreset(null);showPresetEditor('edit');presetName.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();}));
  const presetLayout=el('div',null,{class:'pq-inline-library'});presetLayout.append(presetBrowse);
  showPresetEditor('browse');presetBody.append(presetMode,presetLayout);

  function promptEditor(key, title, label, placeholder) {
    const {folderKey}=promptFolderSpec(key);
    const caption=text=>key==='characters' ? `캐릭터 ${text}` : text;
    const promptGroups=()=>[{id:'',name:'미분류'},...library[folderKey]];
    const filterPrompts=(search,filter)=>orderedChunks(library,key).filter(item=>(!filter || (filter==='unfiled' ? !item.folderId : item.folderId===filter.slice(7))) && `${item.name}\n${item.prompt}\n${item.negativePrompt}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    function promptFilterOptions(input) {const selected=input.value;input.replaceChildren(el('option','전체 폴더',{value:''}),el('option','미분류',{value:'unfiled'}),...library[folderKey].map(item=>el('option',item.name,{value:`folder:${item.id}`})));input.value=[...input.children].some(option=>option.value===selected) ? selected : '';}
    const body = section(title);
    const layout=el('div',null,{class:'pq-library-layout pq-with-folders'});
    const browse=el('div',null,{class:'pq-library-browse'}),editor=el('div',null,{class:'pq-library-editor'});
    let editorOpen=false;const opened=new Set(['']);
    const mode=el('div',null,{class:'pq-library-mode'});
    function setMode(value) {body.dataset.libraryMode=value;if (value==='edit') {editorOpen=true;renderManager();editor.scrollIntoView?.({block:'nearest'});}for (const control of mode.children) control.setAttribute('aria-pressed',String(control.dataset.mode===value));}
    for (const [caption,value] of [['목록 보기','browse'],['편집 보기','edit']]) {
      const control=el('button',caption,{type:'button','data-mode':value});control.addEventListener('click',()=>setMode(value));mode.append(control);
    }
    setMode('browse');body.append(mode,layout);layout.append(browse,editor);
    const select = field(`저장한 ${label}`,'select');
    const name = field(`${label} 이름`);
    const prompt = field(`${label} 프롬프트`,'textarea',{placeholder});
    const negative = field(`${label} 네거티브`,'textarea');
    const folder = field(`${label} 폴더`,'select');
    const folderPicker=folder ? buttonPicker(folder,{caption:'소속 폴더'}) : null;
    let resetFolderCreate=()=>{};
    let renderManager = () => {};
    let refreshFolders = () => {};
    let resetView = () => {};
    function fill(value) {
      editorOpen=true;
      name.input.value = value?.name || '';
      prompt.input.value = value?.prompt || '';
      negative.input.value = value?.negativePrompt || '';
      if (folder) {if (value) opened.add(value.folderId || '');folder.input.value=value?.folderId || '';folderPicker.render();}
      renderManager();
    }
    select.input.addEventListener('change',() => {fill(library[key].find(item => item.id === select.input.value));for (const refresh of orderRefreshers) refresh();});
    if (folder) {
      const rail=el('div',null,{class:'pq-folder-rail','aria-label':`${label} 폴더 탐색`});
      const folderButtons=el('div',null,{class:'pq-folder-buttons'});rail.append(el('strong','폴더'),folderButtons);layout.replaceChildren(rail,browse,editor);
      const folderTools=el('details');folderTools.append(el('summary','폴더 관리'));
      const managedFolder=field(`관리할 ${label} 폴더`,'select');
      const folderName=field(`${label} 폴더 이름`,'input',{placeholder:key==='characters' ? '예: 주연, 조연, 작품 이름' : '예: 표정, 행동, 배경'});
      function chooseManagedFolder() {
        folderName.input.value=library[folderKey].find(item=>item.id===managedFolder.input.value)?.name || '';
        for (const refresh of orderRefreshers) refresh();
      }
      managedFolder.input.addEventListener('change',chooseManagedFolder);
      const managedFolderPicker=buttonPicker(managedFolder,{onChange:chooseManagedFolder});
      const folderActions=el('div',null,{class:'pq-actions'});
      folderActions.append(action(caption('폴더 저장'),async()=>{
        const value={id:managedFolder.input.value || crypto.randomUUID(),name:nameValue(folderName.input)};
        const next=copy(library),index=next[folderKey].findIndex(item=>item.id===value.id);
        if (index<0) next[folderKey].push(value);else next[folderKey][index]=value;
        await commit(next,`${label} 폴더를 저장했습니다.`);managedFolder.input.value=value.id;
        for (const refresh of orderRefreshers) refresh();
      }),action(caption('새 폴더'),()=>{managedFolder.input.value='';folderName.input.value='';for (const refresh of orderRefreshers) refresh();}));
      const removeFolder=action(caption('선택 폴더 삭제'),async()=>{
        if (!managedFolder.input.value) throw new Error('삭제할 폴더를 선택해 주세요.');
        await commit(removeChunkFolder(library,managedFolder.input.value,key),`폴더를 삭제했습니다. 안의 ${label}는 미분류로 옮겼고 예약은 유지했습니다.`);
        folderName.input.value='';
      });
      folderActions.append(removeFolder);
      orderRefreshers.push(()=>available(removeFolder,library[folderKey].some(item=>item.id===managedFolder.input.value)));
      folderTools.append(managedFolderPicker.wrap,folderName.wrap,folderActions,orderControls(folderKey,()=>managedFolder.input.value,caption('선택 폴더')),el('small','폴더 삭제 시 안의 항목은 미분류로 이동합니다. 프롬프트와 예약은 지우지 않습니다.'));
      const search=field(`${label} 검색`,'input',{type:'search',placeholder:`${label} 이름·프롬프트 검색`});
      const filter=field(`${label} 폴더 필터`,'select');
      const count=el('small',null,{'aria-label':`${label} 목록 개수`,'role':'status'});
      const list=el('div',null,{class:'pq-chunk-list','aria-label':`저장한 ${label} 목록`});
      let draggingChunkId=null,draggingChunkIds=[],managedChunkIds=new Set(),dropBusy=false;
      const management=el('div',null,{class:'pq-chunk-management','aria-label':`선택 ${label} 관리`,title:`체크한 ${label}에 이동·복제·삭제를 함께 적용합니다.`});
      const selectionSummary=el('small',null,{role:'status','aria-label':`관리 선택 ${label} 요약`});
      const moveFolder=field(`이동할 ${label} 폴더`,'select');
      const movePicker=buttonPicker(moveFolder,{caption:'이동할 폴더'});movePicker.wrap.className+=' pq-move-destination';
      const resetMoveCreate=quickFolder(movePicker,caption('이동 대상'),async name=>{
        const editedId=select.input.value,oldFolder=library[key].find(item=>item.id===editedId)?.folderId || '',updateDraft=managedChunkIds.has(editedId)&&folder.input.value===oldFolder;
        const next=createChunkFolder(library,name,[...managedChunkIds],undefined,key),id=next[folderKey].at(-1).id;
        await commit(next,`${name} 폴더를 만들고 ${label} ${managedChunkIds.size}개를 이동했습니다.`);
        if (updateDraft && select.input.value===editedId && folder.input.value===oldFolder) {folder.input.value=id;folderPicker.render();}
        moveFolder.input.value=id;filter.input.value=`folder:${id}`;opened.add(id);renderManager();
      },true);
      resetFolderCreate=quickFolder(folderPicker,`${label} 소속`,async name=>{
        const next=createChunkFolder(library,name,[],undefined,key),id=next[folderKey].at(-1).id;
        await commit(next,`${name} 폴더를 만들었습니다. ${label} 저장을 누르면 새 폴더에 저장됩니다.`);
        folder.input.value=id;folderPicker.render();
      });
      const bulkActions=el('div',null,{class:'pq-actions'});
      const duplicate=action(caption('선택 복제'),async()=>{
        const before=new Set(library[key].map(item=>item.id)),next=duplicateChunks(library,[...managedChunkIds],undefined,key);
        await commit(next,`${label} ${managedChunkIds.size}개를 복제했습니다. 복사본을 선택했습니다.`);
        managedChunkIds=new Set(library[key].filter(item=>!before.has(item.id)).map(item=>item.id));renderManager();
      });
      const removeSelected=action(caption('선택 삭제'),async()=>{
        const count=managedChunkIds.size,editedRemoved=managedChunkIds.has(select.input.value);
        await commit(removeChunks(library,[...managedChunkIds],key),`선택한 ${label} ${count}개를 삭제했습니다. 삭제된 ${label}를 참조하는 예약은 다시 구성해 주세요.`);
        if (editedRemoved) fill(null);
      });
      const clearSelection=action(caption('체크 해제'),()=>{managedChunkIds.clear();renderManager();});
      bulkActions.append(duplicate,removeSelected,clearSelection);
      const moveRow=el('div',null,{class:'pq-bulk-move'});
      const moveSelected=action(caption('선택 이동'),()=>moveChunks([...managedChunkIds],{folderId:moveFolder.input.value}));
      for (const control of [duplicate,removeSelected,clearSelection,moveSelected]) control.dataset.headerFeedback='';
      moveRow.append(movePicker.wrap,moveSelected);management.append(selectionSummary,bulkActions,moveRow);management.hidden=true;
      const dragType=key==='scenes' ? 'application/x-pixai-queue-chunk' : 'application/x-pixai-queue-character';
      function clearDropFeedback() {
        for (const element of root.querySelectorAll('[data-drop-position]')) element.dataset.dropPosition='';
        for (const element of root.querySelectorAll('[data-drop-active]')) element.dataset.dropActive='false';
      }
      function endDrag() {draggingChunkId=null;draggingChunkIds=[];clearDropFeedback();for (const element of root.querySelectorAll('[data-chunk-dragging]')) element.dataset.chunkDragging='false';}
      function updateSelectionSummary() {
        const visible=new Set(filterPrompts(search.input.value,filter.input.value).filter(item=>opened.has(item.folderId || '')).map(item=>item.id));
        const hidden=[...managedChunkIds].filter(id=>!visible.has(id)).length;
        selectionSummary.textContent=`${managedChunkIds.size}개 체크${hidden ? ` · 목록 밖 ${hidden}개 포함` : ''}`;
      }
      function focusChunk(id,folderId) {
        const handle=[...list.querySelectorAll('[data-drag-chunk]')].find(element=>element.dataset.dragChunk===id);
        const destination=[...folderButtons.querySelectorAll('[data-drop-folder]')].find(element=>element.dataset.dropFolder===folderId);
        (handle || destination)?.focus({preventScroll:true});handle?.closest?.('.pq-manager-row')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      }
      async function moveChunks(ids,destination,focusId=ids[0]) {
        if (dropBusy || io.isBusy?.()) return;
        dropBusy=true;
        try {
          const edited=library[key].find(item=>item.id===select.input.value),oldFolder=edited?.folderId || '';
          const originals=selectedChunks(library,ids,key),next=moveChunksTo(library,ids,destination.folderId,destination.targetId ?? null,!!destination.after,key);
          if (library[key].every((item,index)=>item.id===next[key][index]?.id && item.folderId===next[key][index]?.folderId)) return;
          const editedId=select.input.value,updateFolder=ids.includes(editedId) && folder.input.value===oldFolder;
          const folderName=library[folderKey].find(item=>item.id===destination.folderId)?.name || '미분류';
          await commit(next,`${originals.length===1 ? originals[0].name : `${label} ${originals.length}개`} → ${folderName} · 위치를 저장했습니다. 기존 예약 순서는 유지됩니다.`);
          if (updateFolder && select.input.value===editedId && folder.input.value===oldFolder) {folder.input.value=destination.folderId;folderPicker.render();}
          opened.add(destination.folderId);renderManager();focusChunk(focusId,destination.folderId);
        } catch(error) {io.notify(`${label} 이동 실패: ${error.message}`);}
        finally {dropBusy=false;clearDropFeedback();}
      }
      function acceptsDrag(event) {return event.isTrusted!==false && !dropBusy && !io.isBusy?.() && draggingChunkId && draggingChunkIds.every(id=>library[key].some(item=>item.id===id));}
      function dropTarget(element,destination) {
        element.addEventListener('dragover',event=>{
          if (!acceptsDrag(event)) return;
          const target=destination(event);if (!target || draggingChunkIds.includes(target.targetId)) return;
          event.preventDefault();event.stopPropagation();
          if (event.dataTransfer) event.dataTransfer.dropEffect='move';
          clearDropFeedback();
          if (target.targetId) element.dataset.dropPosition=target.after ? 'after' : 'before';else element.dataset.dropActive='true';
        });
        element.addEventListener('dragleave',event=>{
          if (event.relatedTarget && element.contains(event.relatedTarget)) return;
          element.dataset.dropPosition='';element.dataset.dropActive='false';
        });
        element.addEventListener('drop',async event=>{
          if (!acceptsDrag(event)) return;
          const id=draggingChunkId,ids=[...draggingChunkIds],target=destination(event);
          if (!target) return;
          event.preventDefault();event.stopPropagation();
          try {
            if (event.dataTransfer?.getData(dragType)!==JSON.stringify(ids)) return;
            endDrag();await moveChunks(ids,target,id);
          } catch(error) {io.notify(`${label} 이동 실패: ${error.message}`);}
          finally {endDrag();}
        });
      }
      renderManager=()=>{
        managedChunkIds=new Set(library[key].filter(item=>managedChunkIds.has(item.id)).map(item=>item.id));
        folderButtons.replaceChildren();
        const folders=[{id:'',name:'전체',count:library[key].length},{id:'unfiled',name:'미분류',count:library[key].filter(item=>!item.folderId).length},...library[folderKey].map(item=>({id:`folder:${item.id}`,name:item.name,count:library[key].filter(chunk=>chunk.folderId===item.id).length}))];
        for (const item of folders) {
          const control=el('button',null,{type:'button','aria-label':`폴더 보기: ${item.name}`,'aria-pressed':String(filter.input.value===item.id),title:`${item.name} · ${item.count}개`});control.append(el('span',item.name,{class:'pq-folder-label'}),el('small',` · ${item.count}`,{class:'pq-folder-count'}));
          decorateIcon(control,item.id ? 'folder' : 'view_module');
          if (item.id) {control.dataset.dropFolder=item.id==='unfiled' ? '' : item.id.slice(7);dropTarget(control,()=>({folderId:control.dataset.dropFolder}));}
          control.addEventListener('click',()=>{filter.input.value=item.id;renderManager();});folderButtons.append(control);
        }
        const visible=filterPrompts(search.input.value,filter.input.value);editor.remove();list.replaceChildren();
        updateSelectionSummary();
        management.hidden=!managedChunkIds.size;
        selectOptions(moveFolder.input,library[folderKey],'미분류',moveFolder.input.value);
        for (const control of [duplicate,removeSelected,clearSelection,moveSelected]) available(control,managedChunkIds.size>0);
        count.textContent=`검색 결과 ${visible.length} / 전체 ${library[key].length}개 · ⠿ 이동`;count.title=`${label} 옆 ⠿ 손잡이를 드래그해 순서를 바꾸거나 폴더로 옮깁니다.`;
        if (!visible.length) list.append(el('small',library[key].length ? `검색에 맞는 ${label}가 없습니다. 검색어나 폴더 필터를 바꿔 주세요.` : `아래 이름과 프롬프트를 입력해 첫 ${label}를 저장하세요.`,{class:'pq-empty'}));
        for (const group of promptGroups()) {
          const chunks=visible.filter(item=>(item.folderId || '')===group.id);
          if (!chunks.length && (search.input.value.trim() || (filter.input.value && filter.input.value!==`folder:${group.id}` && !(filter.input.value==='unfiled' && !group.id)))) continue;
          const details=el('details',null,{class:'pq-folder-group',[key==='characters' ? 'data-character-folder' : 'data-chunk-folder']:group.id});details.open=opened.has(group.id);
          const summary=el('summary');summary.append(el('span',`${group.name} · ${chunks.length} / ${library[key].filter(item=>(item.folderId || '')===group.id).length}개`,{class:'pq-folder-title'}));
          if (group.id) {const title=summary.children[0];title.remove();summary.append(libraryOrderHandle(summary,folderKey,group,caption('폴더')),title);}
          if (group.id) {const menu=el('button','⋮',{type:'button','aria-label':`${caption('폴더 관리')}: ${group.name}`});menu.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();managedFolder.input.value=group.id;chooseManagedFolder();managedFolderPicker.render();folderTools.open=true;folderTools.scrollIntoView?.({block:'nearest'});});summary.append(menu);}
          summary.dataset.dropFolder=group.id;dropTarget(summary,()=>({folderId:group.id}));details.append(summary);
          details.addEventListener('toggle',()=>{if (details.open) opened.add(group.id);else opened.delete(group.id);updateSelectionSummary();});
          for (const chunk of chunks) {
            const row=el('div',null,{class:'pq-manager-row','data-selected':String(select.input.value===chunk.id),'data-managed':String(managedChunkIds.has(chunk.id)),'data-chunk-id':chunk.id});
            const checkbox=el('input',null,{type:'checkbox','data-edit':'','aria-label':`${label} 관리 선택: ${chunk.name}`});checkbox.checked=managedChunkIds.has(chunk.id);checkbox.disabled=!!io.isBusy?.();
            checkbox.addEventListener('change',()=>{if (io.isBusy?.() || dropBusy) {checkbox.checked=managedChunkIds.has(chunk.id);return;}if (checkbox.checked) managedChunkIds.add(chunk.id);else managedChunkIds.delete(chunk.id);renderManager();const current=[...list.querySelectorAll('input')].find(element=>element.getAttribute('aria-label')===`${label} 관리 선택: ${chunk.name}`);current?.focus({preventScroll:true});current?.closest?.('.pq-manager-row')?.scrollIntoView?.({block:'nearest',inline:'nearest'});});
            const handle=el('button','⠿',{type:'button',class:'pq-drag-handle',draggable:'true','data-edit':'','data-drag-chunk':chunk.id,'aria-label':`${label} 이동: ${chunk.name}`,title:'드래그해서 순서·폴더 이동 · 키보드 ↑↓로 순서 변경'});
            handle.textContent='';decorateIcon(handle,'drag_indicator');
            handle.disabled=!!io.isBusy?.();
            handle.addEventListener('dragstart',event=>{
              if (event.isTrusted===false || dropBusy || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}
              try {
                const ids=managedChunkIds.has(chunk.id) ? selectedChunks(library,[...managedChunkIds],key).map(item=>item.id) : [chunk.id];
                event.dataTransfer.setData(dragType,JSON.stringify(ids));event.dataTransfer.effectAllowed='move';
                event.dataTransfer.setDragImage?.(row,12,12);draggingChunkId=chunk.id;draggingChunkIds=ids;row.dataset.chunkDragging='true';
              } catch {event.preventDefault();endDrag();}
            });
            handle.addEventListener('dragend',endDrag);
            handle.addEventListener('keydown',async event=>{
              if (event.isTrusted===false || !['ArrowUp','ArrowDown'].includes(event.key) || dropBusy || io.isBusy?.()) return;
              event.preventDefault();
              const items=library[key].filter(item=>item.folderId===chunk.folderId),index=items.findIndex(item=>item.id===chunk.id),after=event.key==='ArrowDown',target=items[index+(after ? 1 : -1)];
              if (target) await moveChunks([chunk.id],{folderId:chunk.folderId || '',targetId:target.id,after});
            });
            dropTarget(row,event=>({folderId:chunk.folderId || '',targetId:chunk.id,after:event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2}));
            const edit=action(chunk.name,()=>{if (select.input.value===chunk.id) {editorOpen=!editorOpen;renderManager();} else {select.input.value=chunk.id;fill(chunk);}if (editorOpen) {editor.parentElement?.scrollIntoView?.({block:'start'});name.input.focus({preventScroll:true});}for (const refresh of orderRefreshers) refresh();});edit.className='pq-name-button';edit.dataset.viewOnly='';edit.setAttribute('aria-expanded',String(select.input.value===chunk.id && editorOpen));
            edit.setAttribute('aria-label',`${label} 편집: ${chunk.name}`);
            const header=el('div',null,{class:'pq-chunk-row-head'});header.append(checkbox,handle,edit,orderControls(key,()=>chunk.id,`${label} ${chunk.name}`,false,true));
            row.append(header,previewMaterial(el,chunk));if (select.input.value===chunk.id && editorOpen) row.append(editor);details.append(row);
          }
          list.append(details);
        }
        editor.hidden=!editorOpen;if (!editor.parentElement) list.append(editor);
      };
      search.input.addEventListener('input',renderManager);filter.input.addEventListener('change',renderManager);
      refreshFolders=()=>{
        selectOptions(folder.input,library[folderKey],'미분류',folder.input.value);
        selectOptions(managedFolder.input,library[folderKey],'새 폴더',managedFolder.input.value);
        promptFilterOptions(filter.input);renderManager();
      };
      resetView=()=>{endDrag();managedChunkIds.clear();resetFolderCreate();resetMoveCreate();search.input.value='';filter.input.value='';opened.clear();opened.add('');folderName.input.value=library[folderKey].find(item=>item.id===managedFolder.input.value)?.name || '';};
      filter.wrap.hidden=true;rail.append(filter.wrap);rail.hidden=true;
      browse.append(search.wrap,folderTools,count,list);body.append(management);layout.className='pq-inline-library';layout.replaceChildren(browse,rail);
    }
    const controls=el('div',null,{class:'pq-actions'});
    controls.append(action(`${label} 저장`,async () => {
      const value = {id:select.input.value || crypto.randomUUID(),name:nameValue(name.input),prompt:prompt.input.value.trim(),negativePrompt:negative.input.value.trim(),...(folder?.input.value ? {folderId:folder.input.value} : {})};
      if(key==='characters'){const previous=library.characters.find(v=>v.id===value.id);if(previous?.defaultPresetId)value.defaultPresetId=previous.defaultPresetId;}
      if (!value.prompt && !value.negativePrompt) throw new Error(`${label} 프롬프트나 네거티브를 입력해 주세요.`);
      const next = copy(library); const index = next[key].findIndex(item => item.id === value.id);
      if (index < 0) next[key].push(value); else next[key][index] = value;
      await commit(next,`${label} 프롬프트를 저장했습니다.`); select.input.value = value.id;opened.add(value.folderId || '');renderManager();for (const refresh of orderRefreshers) refresh();
    }),action(`새 ${label}`,() => {select.input.value = '';fill(null);setMode('edit');name.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();}));
    const remove=action(`선택 ${label} 삭제`,async () => {
      const id = select.input.value;
      if (!id) throw new Error(`삭제할 ${label}을 선택해 주세요.`);
      const next = copy(library); next[key] = next[key].filter(item => item.id !== id);
      await commit(next,`${label}을 삭제했습니다. 이미 등록한 대기열은 유지됩니다.`); fill(null);
    });
    controls.append(remove);orderRefreshers.push(()=>available(remove,library[key].some(item=>item.id===select.input.value)));
    controls.append(...orderControls(key,()=>select.input.value,`선택 ${label}`).children);
    controls.append(action(`${label} 편집 닫기`,()=>{editorOpen=false;renderManager();}));
    select.wrap.hidden=true;editor.append(el('strong',`${label} 편집`),select.wrap,name.wrap,...(folder ? [folderPicker.wrap] : []),prompt.wrap,negative.wrap,controls);
    const create=action(`새 ${label} 만들기`,()=>{select.input.value='';fill(null);setMode('edit');name.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();});browse.append(create);
    return {key,select:select.input,label,fill,resetView,refresh:()=>{selectOptions(select.input,orderedChunks(library,key),`새 ${label}`,select.input.value);refreshFolders();}};
  }
  const characterEditor = promptEditor('characters','③ 캐릭터 프롬프트','캐릭터','외모, 의상, 캐릭터 고유 특징');
  const chunkEditor = promptEditor('scenes','④ 프롬프트 청크','청크','표정, 행동, 구도, 배경 등 함께 쓸 프롬프트 조각');
  const reserveBody = section('⑤ 조합 예약',true);
  const reservePreset = field('예약 프리셋','select');
  const reserveCharacter = field('예약 캐릭터','select');
  const reservePresetPicker=buttonPicker(reservePreset,{icon:'tune',caption:'프리셋',empty:false,onChange:preview});
  const reserveCharacterPicker=buttonPicker(reserveCharacter,{icon:'person',caption:'캐릭터',empty:false,onChange:preview,groups:()=>[{id:'',name:'미분류'},...library.characterFolders].map(group=>({...group,ids:library.characters.filter(item=>(item.folderId || '')===group.id).map(item=>item.id)}))});
  const chunkList = el('div',null,{class:'pq-chunk-list','aria-label':'예약 청크 목록'});
  const chunkSearch = field('예약 청크 검색','input',{type:'search',placeholder:'함께 쓸 청크 이름·프롬프트 검색'});
  const chunkFilter = field('예약 청크 폴더 필터','select');
  const chunkFilterPicker=buttonPicker(chunkFilter,{caption:'청크 폴더',editable:false,onChange:()=>{renderChunkChoices();preview();}});
  const chunkCount = el('div',null,{class:'pq-selected-chunks','aria-label':'선택한 청크 요약','role':'status'});
  const pickerOpened = new Set(['']);
  let groupSummaries = new Map();
  let selectedChunkIds = new Set();
  let missingMaterials=[],loadedCombination=false,recipeDrag=null,triggerPosition=1,draftReady=false,lastDraftText='',draftSaveError='';
  const reserveCount = field('이 조합의 생성 횟수','input',{type:'number',min:'1',max:'100',value:'1'});
  const reserveRatio=field('조합 이미지 비율','select'),reserveSize=field('조합 이미지 크기','select'),reserveBatch=field('생성당 이미지 수','select'),reserveMode=field('조합 생성 모드','select');
  for (const ratio of API_RATIOS) {
    const [width,height]=ratio.split(':').map(Number);
    reserveRatio.input.append(el('option',`${ratio} · ${width>height ? '가로' : width<height ? '세로' : '정사각'}`,{value:ratio}));
  }
  for (const size of ['1k','1.5k']) reserveSize.input.append(el('option',size,{value:size}));
  for (const [value,name] of [[1,'1장'],[4,'4장 배치']]) reserveBatch.input.append(el('option',name,{value:String(value)}));
  for (const [value,name] of [['','모델 기본값'],['lite','Lite'],['standard','Standard'],['pro','Pro'],['ultra','Ultra']]) reserveMode.input.append(el('option',name,{value}));
  const reserveRatioPicker=buttonPicker(reserveRatio,{caption:'이미지 비율',icon:'image',empty:false,onChange:chooseRecipeImages});
  const reserveSizePicker=buttonPicker(reserveSize,{caption:'이미지 크기',icon:'image',empty:false,onChange:chooseRecipeImages});
  const reserveBatchPicker=buttonPicker(reserveBatch,{caption:'생성당 이미지 수',icon:'image',empty:false,onChange:chooseRecipeImages});
  const reserveModePicker=buttonPicker(reserveMode,{caption:'생성 모드',icon:'tune',onChange:chooseRecipeImages});
  reserveModePicker.wrap.className+=' pq-mode-picker';
  const imageSettingsNote=el('small',null,{'aria-label':'현재 조합 이미지 설정',role:'status',title:'비율은 가로:세로입니다. 새 예약마다 비율·크기·생성 모드·배치 수를 보관합니다.'});
  const imageSettings=el('div',null,{class:'pq-reservation-image'}),imagePickers=el('div',null,{class:'pq-inline'});
  root.append(el('style','#local-pixai-queue .pq-reservation-image{flex:none;min-width:0;margin:4px 0 8px;padding:0}#local-pixai-queue .pq-reservation-image>.pq-inline{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:8px}#local-pixai-queue .pq-reservation-image .pq-choice-list{height:78px}#local-pixai-queue .pq-reservation-image .pq-mode-picker .pq-choice-list{height:auto;min-height:0;max-height:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}#local-pixai-queue .pq-mode-picker .pq-choice-list>button:first-child{grid-column:1/-1}#local-pixai-queue .pq-mode-picker .pq-choice-list>button{min-width:0;padding-left:6px;padding-right:6px}#local-pixai-queue .pq-choice-list>.pq-folder-group{flex:none;width:100%}'));
  imagePickers.append(reserveRatioPicker.wrap,reserveSizePicker.wrap,reserveModePicker.wrap,reserveBatchPicker.wrap);imageSettings.append(imagePickers,imageSettingsNote);
  const defaultRecipeImages=()=>{const options=normalizeApiOptions(io.getImageOptions?.() || {});return {aspectRatio:options.aspectRatio,size:options.size,mode:options.mode,batchSize:io.getBatchSize?.() || 4};};
  let recipeImages=defaultRecipeImages();
  function setRecipeImages(value) {
    recipeImages=normalizeReservationImageOptions({...defaultRecipeImages(),...(value ? normalizeReservationImageOptions(value) : {})});
    reserveRatio.input.value=recipeImages.aspectRatio;reserveSize.input.value=recipeImages.size;reserveMode.input.value=recipeImages.mode;reserveBatch.input.value=String(recipeImages.batchSize);
    reserveRatioPicker.render();reserveSizePicker.render();reserveModePicker.render();reserveBatchPicker.render();
  }
  function chooseRecipeImages() {
    try {
      if (io.isBusy?.()) throw new Error('설정 처리가 끝난 뒤 조합 이미지 설정을 골라 주세요.');
      const images=normalizeReservationImageOptions({aspectRatio:reserveRatio.input.value,size:reserveSize.input.value,mode:reserveMode.input.value,batchSize:Number(reserveBatch.input.value)});
      io.saveImageOptions?.(images);recipeImages=images;
    } catch(error) {setRecipeImages(recipeImages);io.notify(`이미지 설정 저장 실패: ${error.message}`);}
    preview();io.imageOptionsChanged?.();
  }
  setRecipeImages();
  for (const control of [reserveRatio.input,reserveSize.input,reserveMode.input,reserveBatch.input]) control.addEventListener('change',chooseRecipeImages);
  const combined = el('div',null,{class:'pq-preview','aria-label':'저장한 프롬프트 조합 미리보기'});
  const sequenceList=el('div',null,{class:'pq-sequence-list','aria-label':'합쳐지는 순서'});
  const missingNotice=el('div',null,{class:'pq-missing-notice',role:'status'});
  const acknowledgeMissing=action('누락 재료 제외하고 계속',()=>{missingMaterials=[];preview();});
  const selectedChunksInOrder=()=>[...selectedChunkIds].map(id=>library.scenes.find(chunk=>chunk.id===id)).filter(Boolean);
  const recipe=()=>({presetId:reservePreset.input.value,characterId:reserveCharacter.input.value,sceneIds:[...selectedChunkIds],triggerPosition,count:repeatValue(reserveCount.input),imageOptions:{...recipeImages}});
  function saveComposeDraft() {
    if (!draftReady || !io.saveDraft) return;
    let draft;try {draft=normalizeComposeDraft(recipe());} catch {return;} // An unfinished count must not erase the last valid draft.
    const text=JSON.stringify(draft);if (text===lastDraftText) return;
    try {io.saveDraft(draft);lastDraftText=text;draftSaveError='';}
    catch(error) {const message=`조합 편집 상태 저장 실패: ${error.message}`;if (message!==draftSaveError) io.notify(message);draftSaveError=message;}
  }
  function sequenceKeys() {
    const keys=['common','character',...[...selectedChunkIds].map(id=>'chunk:'+id)];
    keys.splice(triggerPosition==='end' ? keys.length : Math.min(triggerPosition,keys.length),0,'trigger');return keys;
  }
  function movedSequence(id,target,after=false) {
    const keys=sequenceKeys();if (id===target || !keys.includes(id) || !keys.includes(target) || !['trigger',...keys.filter(key=>key.startsWith('chunk:'))].includes(id)) return null;
    keys.splice(keys.indexOf(id),1);keys.splice(keys.indexOf(target)+(after ? 1 : 0),0,id);
    const fixed=keys.filter(key=>key!=='trigger');if (fixed[0]!=='common' || fixed[1]!=='character') return null;return keys;
  }
  function moveRecipe(id,target,after=false) {
    if (io.isBusy?.()) return;
    const keys=movedSequence(id,target,after);if (!keys) return;
    selectedChunkIds=new Set(keys.filter(key=>key.startsWith('chunk:')).map(key=>key.slice(6)));
    const position=keys.indexOf('trigger');triggerPosition=position===keys.length-1 ? 'end' : position;preview();
  }
  function renderSequence(preset,character,chunks) {
    sequenceList.replaceChildren();
    const commonBlock=presetPreviewText(library,preset||{});
    const materials=[{id:'common',name:'공통문',text:commonBlock.prompt||commonBlock.negativePrompt},{id:'character',name:'캐릭터',text:character?.prompt},
      {id:'trigger',name:'LoRA 트리거',text:preset?.loras.map(item=>item.triggerWords || '').filter(Boolean).join(', ')},
      ...chunks.map((chunk,index)=>({id:'chunk:'+chunk.id,name:chunk.name,text:chunk.prompt || chunk.negativePrompt,chunk,index}))];
    const keys=sequenceKeys();
    for (const [order,key] of keys.entries()) {
      const item=materials.find(material=>material.id===key),movable=item.id==='trigger' || !!item.chunk;
      const row=el('div',null,{class:movable ? 'pq-recipe-row' : 'pq-fixed-material','data-recipe-material':item.id});
      if (item.chunk) row.dataset.recipeChunk=item.chunk.id;
      const handle=movable ? el('button',null,{type:'button','data-edit':'',draggable:'true','aria-label':item.chunk ? '조합 청크 이동: '+item.name : 'LoRA 트리거 이동',title:'끌어서 조합 순서 변경'}) : null;
      if (handle) {decorateIcon(handle,'drag_indicator');handle.disabled=!!io.isBusy?.();
        handle.style.touchAction='none';
        let pointerDrag=null;
        if (document.elementFromPoint) handle.setAttribute('draggable','false');
        function pointerTarget(event) {
          const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-recipe-material]');
          if (!target || !sequenceList.contains(target) || target.dataset.recipeMaterial===item.id) return null;
          return {id:target.dataset.recipeMaterial,element:target,after:event.clientY>=target.getBoundingClientRect().top+target.getBoundingClientRect().height/2};
        }
        function clearPointer() {pointerDrag=null;for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';}
        handle.addEventListener('pointerdown',event=>{
          if (!document.elementFromPoint || event.isTrusted===false || io.isBusy?.() || event.button!==0 || event.isPrimary===false) return;
          event.preventDefault();pointerDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener('pointermove',event=>{
          if (!pointerDrag || event.pointerId!==pointerDrag.id || event.isTrusted===false || io.isBusy?.()) return;
          if (Math.hypot(event.clientX-pointerDrag.x,event.clientY-pointerDrag.y)<5 && !pointerDrag.moved) return;
          pointerDrag.moved=true;const target=pointerTarget(event);for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';if (target) target.element.dataset.dropPosition=target.after ? 'after' : 'before';
        });
        handle.addEventListener('pointerup',event=>{
          if (!pointerDrag || event.pointerId!==pointerDrag.id) return;
          const target=pointerDrag.moved && event.isTrusted!==false && !io.isBusy?.() ? pointerTarget(event) : null;clearPointer();if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);if (target) moveRecipe(item.id,target.id,target.after);
        });
        handle.addEventListener('pointercancel',clearPointer);handle.addEventListener('lostpointercapture',clearPointer);
        const type='application/x-pixai-combination-order';
        handle.addEventListener('dragstart',event=>{if (event.isTrusted===false || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}recipeDrag=item.id;event.dataTransfer.setData(type,item.id);event.dataTransfer.effectAllowed='move';});
        handle.addEventListener('dragend',()=>{recipeDrag=null;for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';});
      }
      const type='application/x-pixai-combination-order';
      row.addEventListener('dragover',event=>{if (event.isTrusted===false || io.isBusy?.() || !recipeDrag || recipeDrag===item.id) return;event.preventDefault();row.dataset.dropPosition=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2 ? 'after' : 'before';});
      row.addEventListener('dragleave',()=>{row.dataset.dropPosition='';});
      row.addEventListener('drop',event=>{if (event.isTrusted===false || io.isBusy?.() || !recipeDrag || event.dataTransfer?.getData(type)!==recipeDrag) return;event.preventDefault();const id=recipeDrag;recipeDrag=null;moveRecipe(id,item.id,event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);});
      const title=el('div',null,{class:'pq-recipe-title'});title.append(el('strong',item.chunk ? (item.index+1)+'. '+item.name : item.name),el('small',item.text || '없음'));
      if (!movable) {row.append(title);sequenceList.append(row);continue;}
      const controls=el('div',null,{class:'pq-actions'});
      for (const direction of [-1,1]) {const target=keys[order+direction],control=action(direction<0 ? '↑' : '↓',()=>{if (target) moveRecipe(item.id,target,direction>0);});control.setAttribute('aria-label',item.chunk ? '조합 '+item.name+' '+(direction<0 ? '위로' : '아래로') : 'LoRA 트리거 '+(direction<0 ? '위로' : '아래로'));available(control,!!target && !!movedSequence(item.id,target,direction>0));controls.append(control);}
      if (item.chunk) {const remove=action('×',()=>{selectedChunkIds.delete(item.chunk.id);renderChunkChoices();preview();});remove.setAttribute('aria-label','조합에서 제외: '+item.name);controls.append(remove);}
      row.append(handle,title,controls);sequenceList.append(row);
    }
    if (!chunks.length) sequenceList.append(el('small','왼쪽에서 청크를 체크하면 선택한 순서대로 쌓입니다.',{class:'pq-empty'}));
    for (const label of chunkList.querySelectorAll('[data-selection-id]')) {const index=[...selectedChunkIds].indexOf(label.dataset.selectionId);label.textContent=index<0 ? '' : String(index+1);}
  }
  const reservations = el('div',null,{class:'pq-reservation-list'});
  const visibleChunks = () => filterChunks(chunkSearch.input.value,chunkFilter.input.value).filter(chunk=>pickerOpened.has(chunk.folderId || ''));
  const selectVisible = action('보이는 청크 모두 선택',()=>{for (const chunk of visibleChunks()) selectedChunkIds.add(chunk.id);renderChunkChoices();preview();});
  const clearSelected = action('청크 선택 전부 해제',()=>{selectedChunkIds.clear();renderChunkChoices();preview();});
  selectVisible.setAttribute('aria-label','보이는 청크 모두 선택');selectVisible.textContent='모두 선택';decorateIcon(selectVisible,'playlist_add');
  clearSelected.setAttribute('aria-label','청크 선택 전부 해제');clearSelected.textContent='선택 해제';decorateIcon(clearSelected,'close');
  const choiceActions=el('div',null,{class:'pq-actions'});choiceActions.append(selectVisible,clearSelected);
  function renderRecipeImages() {
    imageSettingsNote.textContent=`${recipeImages.aspectRatio} · ${recipeImages.size} · ${recipeImages.mode || '모델 기본값'} · ${recipeImages.batchSize}장 · 예약별 저장`;
    const modeName=({lite:'Lite',standard:'Standard',pro:'Pro',ultra:'Ultra'})[recipeImages.mode]||'모델 기본값';
    imageGroup.setSummary(`${recipeImages.aspectRatio} ${ratioDescription(recipeImages.aspectRatio)} · ${recipeImages.size} · ${modeName} · ${recipeImages.batchSize}장`);
  }
  function recipeImageSummary(options) {return `${options.aspectRatio} ${ratioDescription(options.aspectRatio)} · ${options.size}${Object.hasOwn(options,'mode') ? ` · ${options.mode || '모델 기본값'}` : ''}${options.batchSize ? ` · ${options.batchSize}장` : ''}`;}
  function preview() {
    renderRecipeImages();
    const preset = library.presets.find(item => item.id === reservePreset.input.value);
    const character = library.characters.find(item => item.id === reserveCharacter.input.value);
    const chunks = selectedChunksInOrder();
    materialGroup.setSummary(`${preset?.name||'프리셋 미선택'} · ${character?.name||'캐릭터 미선택'}${preset?.commonPresetId&&!library.commonPresets?.some(item=>item.id===preset.commonPresetId)?' · 공통문 연결 확인 필요':''}`);
    chunkGroup.setSummary(chunks.length?`${chunks.length}개 선택 · ${chunks.map(chunk=>chunk.name).join(' → ')}`:'선택한 청크 없음');
    if (triggerPosition!=='end') triggerPosition=Math.min(triggerPosition,chunks.length+2);
    let effectiveCommon;try {effectiveCommon=resolvePresetCommon(library,preset);}catch(error){combined.textContent=error.message;available(addReservation,false);available(favoriteCurrent,false);return;}
    const {prompt,negativePrompt} = composePresetPrompts(effectiveCommon,character || {},chunks,preset || {loras:[]},triggerPosition);
    const visible=visibleChunks(),visibleIds=new Set(visible.map(chunk=>chunk.id)),hidden=chunks.filter(chunk=>!visibleIds.has(chunk.id)).length;
    chunkCount.textContent = chunks.length ? `${chunks.length}개 선택 · ${chunks.map(chunk=>chunk.name).join(' · ')}` : '선택한 청크 없음 · 청크 없이 예약할 수 있습니다.';
    chunkCount.append(el('small',hidden ? `현재 목록 밖에 선택 ${hidden}개가 있습니다. 선택한 청크는 모두 함께 예약됩니다.` : '선택 순서대로 합칩니다. 가운데 목록에서 끌어 순서를 바꿀 수 있습니다.'));
    selectVisible.title=`검색·필터에 맞고 펼쳐진 목록의 청크 ${visible.length}개를 추가 선택합니다. 기존 선택도 유지합니다.`;
    available(selectVisible,visible.some(chunk=>!selectedChunkIds.has(chunk.id)));available(clearSelected,chunks.length>0);
    for (const group of chunkGroups()) {
      const all=library.scenes.filter(chunk=>(chunk.folderId || '')===group.id),selected=all.filter(chunk=>selectedChunkIds.has(chunk.id)).length;
      const summary=groupSummaries.get(group.id);
      if (summary) summary.textContent=`${group.name} · 선택 ${selected} / 전체 ${all.length}개`;
    }
    combined.textContent = `전송 프롬프트\n${prompt || '(비어 있음)'}${negativePrompt ? `\n\n네거티브\n${negativePrompt}` : ''}`;
    missingMaterials=missingMaterials.filter(item=>item==='프리셋' ? !preset : item==='캐릭터' ? !character : true);
    missingNotice.hidden=!missingMaterials.length;missingNotice.textContent=missingMaterials.length ? `불러온 조합에서 없는 재료: ${missingMaterials.join(', ')}. 다시 선택하거나 누락 재료 제외를 확인해 주세요.` : '';
    if (missingMaterials.length) missingNotice.append(acknowledgeMissing);
    available(addReservation,!!preset && !!character && !missingMaterials.length && !!prompt);available(favoriteCurrent,!!preset && !!character && !missingMaterials.length && !!prompt);
    renderSequence(preset,character,chunks);
    saveComposeDraft();
  }
  for (const event of ['input','change']) reserveCount.input.addEventListener(event,preview);
  for (const select of [reservePreset.input,reserveCharacter.input]) select.addEventListener('change',preview);
  function renderChunkChoices() {
    for (const id of selectedChunkIds) if (!library.scenes.some(item=>item.id===id)) {missingMaterials.push(`청크 ${id}`);selectedChunkIds.delete(id);}
    missingMaterials=[...new Set(missingMaterials)];
    chunkList.replaceChildren();groupSummaries=new Map();
    const visible=filterChunks(chunkSearch.input.value,chunkFilter.input.value);
    if (!visible.length) chunkList.append(el('small',library.scenes.length ? '검색에 맞는 청크가 없습니다. 기존 선택은 위 요약에 유지됩니다.' : '청크 탭에서 청크를 저장해 주세요. 청크 없이 예약할 수도 있습니다.',{class:'pq-empty'}));
    for (const group of chunkGroups()) {
      const chunks=visible.filter(chunk=>(chunk.folderId || '')===group.id);
      if (!chunks.length) continue;
      const details=el('details',null,{class:'pq-folder-group','data-picker-folder':group.id});details.open=pickerOpened.has(group.id);
      const summary=el('summary');groupSummaries.set(group.id,summary);details.append(summary);
      details.addEventListener('toggle',()=>{if (details.open) pickerOpened.add(group.id);else pickerOpened.delete(group.id);preview();});
      for (const chunk of chunks) {
        const checkbox = el('input',null,{type:'checkbox','data-edit':'','aria-label':`청크 선택: ${chunk.name}`});
        checkbox.disabled=!!io.isBusy?.();
        checkbox.checked = selectedChunkIds.has(chunk.id);
        checkbox.addEventListener('change',()=>{
          if (io.isBusy?.()) {checkbox.checked=selectedChunkIds.has(chunk.id);return;}
          if (checkbox.checked) selectedChunkIds.add(chunk.id); else selectedChunkIds.delete(chunk.id);
          preview();
        });
        const name = el('span',chunk.name);name.append(previewMaterial(el,chunk));
        const label = el('label',null,{class:'pq-chunk-option'});label.append(checkbox,name,el('span',null,{class:'pq-selection-number','data-selection-id':chunk.id}));details.append(label);
      }
      chunkList.append(details);
    }
  }
  chunkSearch.input.addEventListener('input',()=>{renderChunkChoices();preview();});
  chunkFilter.input.addEventListener('change',()=>{renderChunkChoices();preview();});
  function refreshLists() {
    selectOptions(presetSelect.input,library.presets,'새 프리셋',presetSelect.input.value);
    renderPresetList();
    for (const editor of [characterEditor,chunkEditor]) editor.refresh();
    selectOptions(reservePreset.input,library.presets,'프리셋 선택',reservePreset.input.value,!loadedCombination);
    selectOptions(reserveCharacter.input,library.characters,'캐릭터 선택',reserveCharacter.input.value,!loadedCombination);
    folderFilterOptions(chunkFilter.input);renderChunkChoices();for (const refresh of orderRefreshers) refresh();
  }
  const reservationView=io.loadGroupView?.('reservations')||{};let reservationBatch=reservationView.batch||'',reservationGroups=new Set(reservationView.opened||[]);const persistReservationView=()=>{try{io.saveGroupView?.('reservations',{batch:reservationBatch,opened:[...reservationGroups]});}catch{io.notify('예약 목록 보기 저장 실패 · 현재 화면은 유지합니다.');}};
  function renderReservations() {
    reservations.replaceChildren();
    const groups=[...new Map(library.reservations.filter(v=>v.batch).map(v=>[v.batch.id,v.batch])).values()];
    const filters=el('div',null,{class:'pq-queue-toolbar'});
    for(const [id,name] of [['','전체 예약'],['ungrouped','개별 예약'],...groups.map(v=>[v.id,v.name])]){const control=action(name,()=>{reservationBatch=id;persistReservationView();renderReservations();});control.setAttribute('aria-pressed',String(reservationBatch===id));control.setAttribute('data-view-only','');filters.append(control);}reservations.append(filters);
    const parents=new Map();
    if (!library.reservations.length) reservations.append(el('small','저장한 프리셋·캐릭터를 고르고 사용할 청크를 체크해 조합을 추가하세요.'));
    for (const reservation of library.reservations.filter(v=>!reservationBatch||(v.batch?.id||'ungrouped')===reservationBatch)) {
      let parent=reservations;
      if(reservation.batch){let group=parents.get(reservation.batch.id);if(!group){group=el('details',null,{class:'pq-batch-group'});group.open=reservationGroups.has(reservation.batch.id);const summary=el('summary',`${reservation.batch.name} · ${library.reservations.filter(v=>v.batch?.id===reservation.batch.id).length}개 미등록 예약`);group.append(summary,action('이 묶음 예약 제외',()=>parityUI.confirm('이 묶음의 미등록 예약만 제외합니다. 실행 대기열과 저장된 이미지는 유지합니다.',async()=>{const next=copy(library);next.reservations=next.reservations.filter(v=>v.batch?.id!==reservation.batch.id);await commit(next,'미등록 예약 묶음을 제외했습니다.');})));group.addEventListener('toggle',()=>{if(group.open)reservationGroups.add(reservation.batch.id);else reservationGroups.delete(reservation.batch.id);persistReservationView();});parents.set(reservation.batch.id,group);reservations.append(group);}parent=group;}
      const row = el('div',null,{class:'pq-reservation'});
      const preset = reservation.snapshot?.preset || library.presets.find(item => item.id === reservation.presetId);
      const character = reservation.snapshot?.character || library.characters.find(item => item.id === reservation.characterId);
      const chunkNames = reservation.snapshot ? reservation.snapshot.chunks.map(chunk=>chunk.name) : reservation.sceneIds.map(id=>library.scenes.find(item=>item.id===id)?.name || '(삭제된 청크)');
      row.append(el('strong',`${character?.name || '(삭제된 캐릭터)'} · ${chunkNames.join(' + ') || '청크 없음'}`),
        el('small',`${preset?.name || '(삭제된 프리셋)'} · ${reservation.count}회 · ${reservation.imageOptions ? recipeImageSummary(reservation.imageOptions) : '이미지 기본 설정 사용'}${reservation.snapshot ? ' · 추가 시점의 설정 보관' : ''}`),action('이 예약 제외',async () => {
          const next = copy(library); next.reservations = next.reservations.filter(item => item.id !== reservation.id);
          await commit(next,'선택한 예약을 제외했습니다. 이미 등록한 대기열은 유지됩니다.');
        }),orderControls('reservations',()=>reservation.id,`예약 ${character?.name || '삭제된 캐릭터'} ${chunkNames.join(' + ') || '청크 없음'}`,false,true));
      if(reservation.batch)row.append(el('small',`${reservation.batch.rowName} × ${reservation.batch.columnName}`));
      if(reservation.imageOptions)row.prepend?.(ratioMark(el,reservation.imageOptions.aspectRatio));
      parent.append(row);
    }
    renderHistory();
  }
  let scheduleTab='reservations';
  const scheduleTabs=el('div',null,{class:'pq-schedule-tabs','aria-label':'조합 보관함'});
  const recentList=el('div',null,{class:'pq-history-list','aria-label':'최근 조합'}),favoritesList=el('div',null,{class:'pq-history-list','aria-label':'즐겨찾기 조합'});
  const scheduleLists={reservations,recent:recentList,favorites:favoritesList};
  function showSchedule(id) {scheduleTab=id;for (const [key,list] of Object.entries(scheduleLists)) list.hidden=key!==id;for (const button of scheduleTabs.children) button.setAttribute('aria-pressed',String(button.dataset.schedule===id));}
  for (const [id,name] of [['reservations','예약'],['recent','최근'],['favorites','즐겨찾기']]) {const button=el('button',name,{type:'button','data-schedule':id});button.addEventListener('click',()=>showSchedule(id));scheduleTabs.append(button);}
  function loadCombination(entry) {
    if (io.isBusy?.()) return;
    const resolved=resolveCombination(library,entry);
    loadedCombination=true;missingMaterials=resolved.missing;
    reservePreset.input.value=resolved.presetId;reserveCharacter.input.value=resolved.characterId;reserveCount.input.value=String(resolved.count);selectedChunkIds=new Set(resolved.sceneIds);triggerPosition=resolved.triggerPosition ?? 1;
    setRecipeImages(resolved.imageOptions);
    reservePresetPicker.render();reserveCharacterPicker.render();renderChunkChoices();preview();
    io.notify(resolved.missing.length ? `조합을 불러왔지만 없는 재료가 있습니다: ${resolved.missing.join(', ')}. 확인 전에는 예약하지 않습니다.` : '조합을 불러왔습니다. 현재 라이브러리 내용으로 미리보기를 확인해 주세요.');
  }
  async function toggleFavorite(entry) {
    const next=copy(library),target=next.combinations.find(item=>item.id===entry.id);target.favorite=!target.favorite;
    let plain=0;next.combinations=next.combinations.filter(item=>item.favorite || ++plain<=50);
    await commit(next,target.favorite ? '즐겨찾기에 저장했습니다. 카드에서 이름을 붙일 수 있습니다.' : '즐겨찾기를 해제했습니다.');
  }
  function renderHistory() {
    recentList.replaceChildren();favoritesList.replaceChildren();
    const all=library.combinations || [];
    for (const [list,entries] of [[recentList,all.slice(0,50)],[favoritesList,all.filter(item=>item.favorite)]]) {
      if (!entries.length) list.append(el('small',list===recentList ? '예약을 추가하면 조합이 여기에 기록됩니다.' : '☆로 자주 쓰는 조합을 저장하세요.',{class:'pq-empty'}));
      for (const entry of entries) {
        const row=el('div',null,{class:'pq-history-card','data-combination-id':entry.id});
        const preset=library.presets.find(item=>item.id===entry.presetId),character=library.characters.find(item=>item.id===entry.characterId),chunks=entry.sceneIds.map(id=>library.scenes.find(item=>item.id===id)?.name || '(삭제된 청크)');
        row.append(el('strong',entry.name || `${character?.name || '(삭제된 캐릭터)'} · ${chunks.join(' + ') || '청크 없음'}`),el('small',`${preset?.name || '(삭제된 프리셋)'} · ${entry.count}회 · ${entry.imageOptions ? recipeImageSummary(entry.imageOptions) : '이미지 기본 설정 사용'}`));
        const controls=el('div',null,{class:'pq-actions'});
        const load=action('불러오기',()=>loadCombination(entry));load.setAttribute('aria-label',`조합 불러오기: ${entry.id}`);
        const star=action(entry.favorite ? '★' : '☆',()=>toggleFavorite(entry));star.setAttribute('aria-label',`조합 즐겨찾기: ${entry.id}`);star.setAttribute('aria-pressed',String(entry.favorite));
        const remove=action('기록 삭제',async()=>{const next=copy(library);next.combinations=next.combinations.filter(item=>item.id!==entry.id);await commit(next,'조합 기록을 삭제했습니다. 예약과 대기열은 유지됩니다.');});remove.setAttribute('aria-label',`조합 기록 삭제: ${entry.id}`);
        controls.append(load,star,remove);row.append(controls);
        if (entry.favorite) {
          const name=field(`즐겨찾기 이름: ${entry.id}`,'input',{placeholder:'즐겨찾기 이름',maxlength:'200'});name.wrap.textContent='즐겨찾기 이름';name.wrap.append(name.input);name.input.value=entry.name;
          const save=action('이름 저장',async()=>{const next=copy(library);next.combinations.find(item=>item.id===entry.id).name=name.input.value.trim();await commit(next,'즐겨찾기 이름을 저장했습니다.');});save.setAttribute('aria-label',`즐겨찾기 이름 저장: ${entry.id}`);row.append(name.wrap,save);
        }
        list.append(row);
      }
    }
    showSchedule(scheduleTab);
  }
  const choiceFilters=el('div',null,{class:'pq-choice-filters'});choiceFilters.append(chunkSearch.wrap,chunkFilter.wrap);
  const choices=el('div',null,{class:'pq-compose-choices'}),review=el('div',null,{class:'pq-compose-review'}),schedule=el('div',null,{class:'pq-compose-schedule'}),composeLayout=el('div',null,{class:'pq-compose-layout'});
  const selectors=el('div',null,{class:'pq-inline pq-reserve-selectors'});selectors.append(reservePresetPicker.wrap,reserveCharacterPicker.wrap);
  const composeGroupState={materials:true,images:false,chunks:true};
  try {const stored=io.loadComposeGroups?.();if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const key of Object.keys(composeGroupState))if(typeof stored[key]==='boolean')composeGroupState[key]=stored[key];}catch{io.notify('조합 접기 상태를 읽지 못해 기본 보기로 열었습니다. 재료와 예약은 유지합니다.');}
  function composeGroup(id,title,...content) {
    const group=el('details',null,{class:'pq-compose-group','data-compose-group':id}),heading=el('summary',null,{title:'접기·펼치기'}),label=el('span',title,{class:'pq-compose-group-title'}),current=el('span',null,{class:'pq-compose-group-value','aria-label':`${title} 현재 선택`}),body=el('div',null,{class:'pq-compose-group-body'});
    decorateIcon(label,({materials:'person',images:'tune',chunks:'layers'})[id]);heading.append(label,current);body.append(...content);group.append(heading,body);group.open=composeGroupState[id];
    group.addEventListener('toggle',()=>{if(composeGroupState[id]===group.open)return;composeGroupState[id]=group.open;try{io.saveComposeGroups?.({...composeGroupState});}catch{io.notify('접기 상태 저장 실패 · 현재 보기는 유지합니다. 재료와 예약에는 영향이 없습니다.');}});
    return {group,setSummary(text){current.textContent=text;current.title=text;heading.setAttribute('aria-label',`${title} · ${text}`);}};
  }
  const materialGroup=composeGroup('materials','프리셋·캐릭터',selectors),imageGroup=composeGroup('images','이미지 설정',imageSettings),chunkGroup=composeGroup('chunks','청크 선택',choiceFilters,choiceActions,chunkCount,chunkList);
  choices.append(materialGroup.group,imageGroup.group,chunkGroup.group);
  root.append(el('style',`
#local-pixai-queue .pq-compose-group{flex:none;min-width:0;margin:0 0 8px;border:1px solid var(--pq-line,#455059);border-radius:8px;background:var(--pq-surface,#20252b)}
#local-pixai-queue .pq-compose-group>summary{position:relative;list-style:none;cursor:pointer;padding:10px 12px 10px 30px;border-radius:8px;min-width:0}
#local-pixai-queue .pq-compose-group>summary::-webkit-details-marker{display:none}
#local-pixai-queue .pq-compose-group>summary:focus-visible{outline:2px solid var(--pq-accent,#78cdb8);outline-offset:2px}
#local-pixai-queue .pq-compose-group>summary::before{content:'›';position:absolute;left:12px;top:10px;font-size:20px;line-height:22px;color:var(--pq-muted,#abb6bd)}
#local-pixai-queue .pq-compose-group[open]>summary::before{transform:rotate(90deg)}
#local-pixai-queue .pq-compose-group[open]>summary{border-bottom:1px solid var(--pq-line,#455059);border-radius:8px 8px 0 0}
#local-pixai-queue .pq-compose-group-title{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:650;line-height:1.5}
#local-pixai-queue .pq-compose-group-value{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;margin-top:3px;font-size:13px;line-height:1.5;color:var(--pq-muted,#abb6bd)}
#local-pixai-queue .pq-compose-group-body{padding:10px;min-width:0;min-height:0}
#local-pixai-queue .pq-compose-group .pq-reservation-image{margin:0}
#local-pixai-queue .pq-compose-group[data-compose-group="chunks"] .pq-compose-group-body{display:flex;flex-direction:column;gap:6px}
#local-pixai-queue .pq-compose-group[data-compose-group="chunks"] .pq-chunk-list{flex:none;min-height:120px;max-height:300px;overflow:auto;margin:0;border:0;overscroll-behavior:contain}
#local-pixai-queue .pq-compose-group .pq-selected-chunks{max-height:70px;overflow:auto;padding:5px 8px;border:0;background:var(--pq-accent-soft,#2c3e40);flex:none}
#local-pixai-queue .pq-compose-group .pq-selected-chunks small{display:none}
@container pqwin (max-width:760px){#local-pixai-queue .pq-compose-group[data-compose-group="chunks"] .pq-chunk-list{min-height:160px;max-height:300px}#local-pixai-queue .pq-compose-group .pq-reserve-selectors{gap:8px}}
`));
  const addReservation=action('이 조합 예약 추가',async () => {
      if (missingMaterials.length) throw new Error('누락 재료를 확인한 뒤 예약해 주세요.');
      const combination=recipe(),{presetId,characterId,sceneIds}=combination;
      if (!library.presets.some(item => item.id === presetId) || !library.characters.some(item => item.id === characterId)) throw new Error('저장한 프리셋·캐릭터를 모두 선택해 주세요.');
      const next = rememberCombination(library,combination);
      next.reservations.push({id:crypto.randomUUID(),...combination,snapshot:snapshotCombination(library,combination)});
      await commit(next,'조합을 예약하고 최근 목록에 기록했습니다. 대기열에 등록한 뒤 시작해 주세요.');showSchedule('reservations');
    });
  const favoriteCurrent=action('☆',async()=>{if (missingMaterials.length) throw new Error('누락 재료를 확인해 주세요.');const combination=recipe();snapshotCombination(library,combination);await commit(rememberCombination(library,combination,{favorite:true}),'현재 조합을 즐겨찾기에 저장했습니다.');showSchedule('favorites');});favoriteCurrent.setAttribute('aria-label','현재 조합 즐겨찾기');
  const reservationActions=el('div',null,{class:'pq-reserve-actions'});reservationActions.append(addReservation,favoriteCurrent);
  const register=action('예약 전부를 대기열에 등록',async () => {
      if (!library.reservations.length) throw new Error('조합 예약을 먼저 추가해 주세요.');
      await io.enqueue(copy(library));
    });register.dataset.headerFeedback='';
  review.append(el('strong','합쳐지는 순서'),sequenceList,el('strong','전송 미리보기'),combined,missingNotice);
  schedule.append(reserveCount.wrap,reservationActions,scheduleTabs,reservations,recentList,favoritesList);
  const composeMode=el('div',null,{class:'pq-compose-mode'});
  for (const [id,name] of [['choices','재료'],['review','순서·미리보기'],['schedule','예약·기록']]) {const button=el('button',name,{type:'button','data-compose-mode':id});button.addEventListener('click',()=>{reserveBody.dataset.composeMode=id;for (const control of composeMode.children) control.setAttribute('aria-pressed',String(control===button));});composeMode.append(button);}
  reserveBody.dataset.composeMode='choices';composeMode.children[0].setAttribute('aria-pressed','true');
  resizable(composeLayout,[choices,review,schedule],'조합 예약',[.35,.35,.30],[250,260,220]);reserveBody.append(composeMode,composeLayout);
  const registrationBar=el('div',null,{class:'pq-registration-bar'}),reservationTotals=el('span',null,{role:'status'});registrationBar.append(reservationTotals,register);root.append(registrationBar);
  const originalRenderReservations=renderReservations;
  renderReservations=function() {originalRenderReservations();reservationTotals.textContent=`예약 ${library.reservations.length}조합 · ${library.reservations.reduce((sum,item)=>sum+item.count,0)}회`;available(register,library.reservations.length>0);};
  libraryPage=section('라이브러리',false,'library');
  const libraryNavigation=el('div',null,{class:'pq-library-tabs',role:'tablist','aria-label':'라이브러리 종류'});
  for (const id of libraryIds) {const view=views.find(item=>item.id===id);libraryNavigation.append(view.tab);libraryPage.append(view.body);}
  libraryPage.replaceChildren(libraryNavigation,...libraryIds.map(id=>views.find(item=>item.id===id).body));
  navigation.replaceChildren(...['compose','library'].map(id=>views.find(item=>item.id===id).tab));
  parityUI=mountParityWorkspace({root,el,action,field,commonBody,resizable,getLibrary:()=>library,commit,refreshCommonChoices,getRecipe:recipe,getImages:()=>({...recipeImages}),reloadLibrary:()=>{library=normalizePresetLibrary(io.load());refreshLists();renderReservations();preview();},loadRecipe:value=>{reservePreset.input.value=value.presetId;reserveCharacter.input.value=value.characterId;reserveCount.input.value=String(value.count||1);selectedChunkIds=new Set(value.sceneIds);triggerPosition=value.triggerPosition??1;setRecipeImages(value.imageOptions);reservePresetPicker.render();reserveCharacterPicker.render();renderChunkChoices();preview();showPage('compose',false,true);},addPage:(id,title)=>{const body=section(title,false,id);navigation.append(views.find(v=>v.id===id).tab);return body;},enqueue:(value,options)=>io.enqueue(value,options),getThumbnail:id=>io.getThumbnail?.(id),io});
  root.append(el('style','#local-pixai-queue .pq-material-preview p{margin:4px 0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;font-size:13px;line-height:1.4}#local-pixai-queue .pq-preview-positive{-webkit-line-clamp:2}#local-pixai-queue .pq-preview-negative{-webkit-line-clamp:1;color:#a9b4bc}#local-pixai-queue .pq-ratio-mark{display:inline-block;flex:none;border:1.5px solid currentColor;border-radius:2px;margin-right:7px}#local-pixai-queue .pq-confirm{position:absolute;inset:15% 12% auto;background:#252b2f;border:1px solid #8bb8b0;padding:16px;z-index:20;border-radius:10px;box-shadow:0 8px 40px #0008}#local-pixai-queue .pq-common-default{flex:none}#local-pixai-queue .pq-common-editor{display:flex;flex-direction:column;gap:6px;padding:8px;overflow:auto}#local-pixai-queue .pq-parity-card{border-bottom:1px solid #455059;padding:8px}'));
  libraryTab='chunks';
  showPage('compose');
  refreshLists(); renderReservations(); preview();
  try {
    const saved=io.loadDraft?.();
    if (saved) {
      const draft=normalizeComposeDraft(saved),resolved=resolveCombination(library,draft);loadedCombination=true;
      missingMaterials=resolved.missing.filter(item=>!(item==='프리셋' && !draft.presetId) && !(item==='캐릭터' && !draft.characterId));
      reservePreset.input.value=resolved.presetId;reserveCharacter.input.value=resolved.characterId;reserveCount.input.value=String(resolved.count);selectedChunkIds=new Set(resolved.sceneIds);triggerPosition=resolved.triggerPosition;
      setRecipeImages(resolved.imageOptions);reservePresetPicker.render();reserveCharacterPicker.render();renderChunkChoices();preview();
    }
  } catch(error) {io.notify(`조합 편집 상태 복원 실패: ${error.message}`);}
  draftReady=true;parent.append(root);
  return {
    root,
    showPage,
    addPage:(id,title,...content)=>{const body=section(title,false,id);body.append(...content);runtimePages.push(body);return body;},
    // Library/compose controls may be used while this tab's runner is busy; runtime pages and site-touching buttons may not.
    allowsWhileRunning:element=>root.contains(element) && !runtimePages.some(page=>page.contains(element)) && element.dataset?.siteIo == null,
    refreshImageOptions:renderRecipeImages,
    getImageOptions:()=>({...recipeImages}),
    addImageActions:(...content)=>imageSettings.append(...content),
    refresh:() => {library = normalizePresetLibrary(io.load() || makePresetLibrary());refreshLists();renderReservations();preview();parityUI?.refresh();},
    reload:() => {
      const next=normalizePresetLibrary(io.load() || makePresetLibrary());
      library=next;selectedChunkIds=new Set();missingMaterials=[];loadedCombination=false;triggerPosition=1;
      setRecipeImages();parityUI?.refresh();
      presetSearch.input.value='';
      chunkSearch.input.value='';chunkFilter.input.value='';pickerOpened.clear();pickerOpened.add('');
      for (const editor of [characterEditor,chunkEditor]) editor.resetView();
      refreshLists();
      commonPrompt.input.value=library.common.prompt;commonNegative.input.value=library.common.negativePrompt;
      fillPreset(library.presets.find(item=>item.id===presetSelect.input.value));
      for (const editor of [characterEditor,chunkEditor]) editor.fill(library[editor.key].find(item=>item.id===editor.select.value));
      reserveCount.input.value='1';renderReservations();preview();
    }
  };
}

  // GraphQL 조회 실패를 HTTP 상태·오류 코드별로 구분한다. 응답 본문 전체·헤더·인증값은 보관하지 않는다.
  function describeQueryFailure(status, payload) {
    const isAuthCode = value => /^(unauthorized|unauthenticated)$/i.test(value);
    const list = Array.isArray(payload?.errors) ? payload.errors.filter(item => item && typeof item === "object") : [];
    const codeOf = item => { const raw = item?.extensions?.code; return typeof raw === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.trim()) ? raw.trim() : ""; };
    const first = list.find(item => isAuthCode(codeOf(item))) || list[0] || null;
    const code = codeOf(first);
    const detail = (typeof first?.message === "string" ? first.message : "").slice(0, 400).replace(/\s+/g, " ").trim().slice(0, 120);
    const tail = " 로그인 문제로 단정할 수 없습니다. 작업 ID와 저장 내역은 유지됩니다.";
    if (status === 401 || isAuthCode(code)) return Object.assign(new Error("조회 인증 실패 (" + (status || 200) + (code ? ", " + code : "") + "). PixAI 로그인 상태를 확인해 주세요. 작업 ID와 저장 내역은 유지됩니다."), {status, code, stage: "auth"});
    if (status === 403) return Object.assign(new Error("조회 접근 거부 (403" + (code ? ", " + code : "") + ")." + tail), {status, code, stage: "forbidden"});
    if (status >= 500) return Object.assign(new Error("PixAI 서버 오류 (" + status + "). 잠시 후 같은 작업 ID로 다시 확인해 주세요."), {status, code, stage: "server"});
    if (payload === null) return Object.assign(new Error("조회 응답이 JSON이 아닙니다 (" + status + "). 네트워크 차단·점검 페이지일 수 있습니다." + tail), {status, code: "", stage: "non-json"});
    if (code === "GRAPHQL_VALIDATION_FAILED" || code === "BAD_USER_INPUT" || status === 400 || status === 422) {
      return Object.assign(new Error("조회 형식 오류 (" + (status || 200) + (code ? ", " + code : "") + "): 스크립트의 조회 형식이 사이트와 맞지 않습니다." + (detail ? " [" + detail + "]" : "") + tail), {status, code, stage: "validation"});
    }
    return Object.assign(new Error("조회 실패 (" + status + (code ? ", " + code : "") + ")." + (detail ? " [" + detail + "]" : "") + tail), {status, code, stage: "other"});
  }
  // fetchImpl는 호출자가 넘긴다(브라우저: 사이트 쿠키 포함 fetch). 결과는 data만 돌려주고 실패는 describeQueryFailure로 구분한다.
  async function graphqlQuery(fetchImpl, operation, query, variables, {signal} = {}) {
    let response;
    try {
      response = await fetchImpl("https://api.pixai.art/graphql?operation=" + encodeURIComponent(operation), {
        method: "POST", credentials: "include", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({operationName: operation, query, variables}), signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw Object.assign(new Error("조회 시간 초과. 같은 작업 ID로 다시 확인할 수 있습니다."), {status: 0, code: "", stage: "timeout"});
      throw Object.assign(new Error("조회 요청을 보내지 못했습니다 (네트워크 오류). 작업 ID와 저장 내역은 유지됩니다."), {status: 0, code: "", stage: "network"});
    }
    let payload = null;
    try { payload = await response.json(); } catch (error) {
      if (error?.name === "AbortError") throw Object.assign(new Error("조회 시간 초과. 같은 작업 ID로 다시 확인할 수 있습니다."), {status: 0, code: "", stage: "timeout"});
      payload = null;
    }
    if (!response.ok || !payload || payload.errors?.length || !payload.data) throw describeQueryFailure(response.status, payload);
    return payload.data;
  }

  // 원본 조회: 사이트 스키마는 media(id: String!). fileUrl은 null일 수 있고 실제 원본은 urls의 PUBLIC(/images/orig/) 변형이다.
  const MEDIA_QUERY = "query getMedia($id: String!) { media(id: $id) { id width height imageType fileUrl urls { variant url } } }";
  function pickOriginalMedia(media, mediaId) {
    if (!media || String(media.id) !== String(mediaId)) throw new Error("원본 이미지 정보를 확인하지 못했습니다 (ID 불일치). 저장하지 않습니다.");
    const urls = Array.isArray(media.urls) ? media.urls.filter(item => item && typeof item.url === "string" && item.url) : [];
    const found = urls.find(item => item.variant === "PUBLIC");
    const url = found ? found.url : (typeof media.fileUrl === "string" ? media.fileUrl : "");
    if (!url) throw new Error("원본 이미지 URL을 확인하지 못했습니다 (제공된 variant: " + (urls.map(item => item.variant).join(", ") || "없음") + "). 썸네일로 대체하지 않고 저장하지 않습니다.");
    return {url, variant: found ? "PUBLIC" : "fileUrl", width: Number.isInteger(media.width) ? media.width : null, height: Number.isInteger(media.height) ? media.height : null};
  }
  function mediaUrlAllowed(href) {
    const url = new URL(href);
    // Confirmed by the official /v1/media/{id}/image redirect for all four
    // outputs on 2026-10-08. Do not allow arbitrary CloudFront distributions.
    if (url.protocol !== "https:" || !(url.hostname === "pixai.art" || url.hostname.endsWith(".pixai.art") || url.hostname === "d2doj8oszwtcqy.cloudfront.net")) throw new Error("예상하지 못한 원본 이미지 호스트입니다. 저장하지 않습니다.");
    return url;
  }
  const API_RATIOS=['1:1','2:3','3:2','3:4','4:3','3:5','5:3','9:16','16:9','1:3','3:1'];
  const API_STYLES=['anime-watercolor-impasto','art-crayon','bold-line-soft-color','chibi','classic-japanese','clean-flat-illustration','colored-pencil-grain','cool-warm-oil-contrast','desaturated-cool','flat-anime-pastel','glossy-glass-anime','grey-blocks-lineless','hard-line-monochrome-accent','high-contrast-retro-vivid','holographic','korean-style','lineart-watercolor-airy','low-saturation-expressive-eyes','lucid-dreamy','luminous-retro-impasto','minimal-flat-color','modern-oil-glamour','moe-pastel','oil-watercolor-blend','painterly-doodle','paper-watercolor','pencil-sketch','poster-graffiti','retro-comic-fusion','retro-oil-glamour','retro-tv-anime','semi-realistic','stable-vaporwave','tinted-sketch','vintage-collage'];
  function normalizeApiOptions(value={}) {
    const s=presetObject(value,'공식 API 옵션');
    if (Object.keys(s).some(key=>!['modelVersionId','aspectRatio','size','mode','style','seed'].includes(key))) throw new Error('공식 API 옵션 형식을 확인해 주세요. 키는 백업에 넣을 수 없습니다.');
    const out={modelVersionId:presetText(s.modelVersionId),aspectRatio:s.aspectRatio ?? '9:16',size:s.size ?? '1k',mode:s.mode ?? '',style:s.style ?? '',seed:s.seed ?? ''};
    if (out.modelVersionId && !/^\d+$/.test(out.modelVersionId)) throw new Error('기본 모델 버전 ID를 숫자로 입력해 주세요.');
    if (!API_RATIOS.includes(out.aspectRatio) || !['1k','1.5k'].includes(out.size)) throw new Error('공식 API 비율·크기를 확인해 주세요.');
    if (!['','lite','standard','pro','ultra'].includes(out.mode)) throw new Error('공식 API 생성 모드를 확인해 주세요.');
    if (out.style!=='' && !API_STYLES.includes(out.style)) throw new Error('공식 API 스타일을 확인해 주세요.');
    if (out.seed!=='') out.seed=presetInteger(out.seed,'시드',0,4294967295);
    return out;
  }
  function buildApiPayload(job, options, batchSize, randomSeed) {
    const opts=normalizeApiOptions(options),config=job.configuration;
    if (![1,4].includes(batchSize)) throw new Error('공식 API는 1장 또는 4장 배치를 지원합니다.');
    const modelVersionId=presetIdentifier(config?.model?.versionId || opts.modelVersionId,'모델 버전',true);
    const prompt=presetText(job.prompt);
    if (!prompt) throw new Error('프롬프트를 입력해 주세요.');
    const loras=config?.loras ?? [];
    if (!Array.isArray(loras) || loras.length>5) throw new Error('공식 API는 LoRA 최대 5개를 지원합니다.');
    const seen=new Set();
    const payload={modelVersionId,prompt,negativePrompt:presetText(job.negativePrompt),aspectRatio:opts.aspectRatio,size:opts.size,
      batchSize,seed:presetInteger(opts.seed==='' ? randomSeed : opts.seed,'시드',0,4294967295),promptHelper:'disable',
      loras:loras.map(item=>{
        const modelId=presetIdentifier(item.versionId,'LoRA 버전',true);
        if (seen.has(modelId)) throw new Error('같은 LoRA 버전이 중복됐습니다.');seen.add(modelId);
        const weight=Number(item.weight);
        if (!['number','string'].includes(typeof item.weight) || (typeof item.weight==='string' && !item.weight.trim()) || !Number.isFinite(weight) || weight<0 || weight>1) throw new Error(`공식 API의 LoRA 수치는 0~1입니다: ${item.name || modelId}. 기존 값을 자동으로 바꾸지 않습니다.`);
        const lora={modelId,weight};
        // Composition already contains the trigger at the user-selected position.
        // Override server defaults to avoid injecting it a second time.
        if (job.composition || Object.hasOwn(item,'triggerWords')) lora.triggerWords='';
        return lora;
      })};
    if (opts.mode) payload.mode=opts.mode;
    if (opts.style) payload.style={type:'preset',key:opts.style};
    return payload;
  }
  function createSessionApiKey() {
    let key='';
    return {set(value){const next=String(value ?? '').trim();if (!next || /[^\x21-\x7e]/.test(next)) throw new Error('API 키 형식을 확인해 주세요.');key=next;},
      clear(){key='';},has(){return !!key;},get(){if (!key) throw new Error('설정 탭에서 공식 API 키를 이 탭에 연결해 주세요.');return key;}};
  }
  function createRememberedApiKey(vault, storage) {
    const slot='pixai.official-api-key.v1';
    const supported=!!storage && ['get','set','remove'].every(name=>typeof storage[name]==='function');
    let state='none';
    const validated=value=>{const candidate=createSessionApiKey();if(typeof value!=='string') throw new Error('API 키 형식을 확인해 주세요.');candidate.set(value);return candidate.get();};
    const checked=action=>{try {return action();} catch {state='unknown';vault.clear();throw new Error('키 저장 상태를 확인하지 못해 이 탭의 연결을 해제했습니다. 저장된 키 삭제 후 다시 연결해 주세요.');}};
    const remove=()=>{storage.remove(slot);if(storage.get(slot,null)!==null) throw new Error('delete verification');};
    return {
      supported,status:()=>state,
      restore(){if(!supported)return;checked(()=>{const saved=storage.get(slot,null);if(saved===null){state='none';return;}vault.set(validated(saved));state='saved';});},
      connect(value,remember=false){
        vault.clear();
        const key=validated(value);
        if(remember && !supported) throw new Error('이 환경에서는 키 기억하기를 지원하지 않습니다. 저장 안 함으로 연결해 주세요.');
        checked(()=>{
          if(supported){if(remember){storage.set(slot,key);if(storage.get(slot,null)!==key)throw new Error('write verification');}else remove();}
          state=remember?'saved':'none';vault.set(key);
        });
      },
      forget(){checked(()=>{if(supported)remove();state='none';});},
      clear(){vault.clear();this.forget();}
    };
  }
  function reconfigureQueuedApiJob(job,options,batchSize,randomSeed) {
    if (job.state!=='queued' || job.taskId || job.saved?.length || job.mediaIds?.length || job.metadataFile) throw new Error('미제출 대기 작업의 API 옵션만 바꿀 수 있습니다. 제출된 작업은 같은 ID로 재개해 주세요.');
    if (job.submittedAt && !/^공식 API 오류 \((400|401|403|404|422)\)\./.test(job.error || '')) throw new Error('이전 제출 결과를 확인할 수 없어 요청을 바꾸지 않습니다.');
    const apiOptions=normalizeApiOptions(options),apiPayload=buildApiPayload(job,apiOptions,batchSize,job.apiPayload?.seed ?? randomSeed);
    const next={...job,apiOptions,apiBatchSize:batchSize,apiPayload,expected:batchSize,error:''};
    if (job.apiPayload) next.apiRequestHistory=[...(job.apiRequestHistory || []),{payload:JSON.parse(JSON.stringify(job.apiPayload)),submittedAt:job.submittedAt ?? null,error:job.error || ''}];
    delete next.submittedAt;
    return next;
  }
  function applyQueuedImageOptions(jobs,options) {
    const current=normalizeApiOptions(options);
    return jobs.map(job=>{
      if (job.state!=='queued' || job.taskId || job.saved?.length || job.mediaIds?.length || job.metadataFile) return job;
      if (job.submittedAt && !/^공식 API 오류 \((400|401|403|404|422)\)\./.test(job.error || '')) return job;
      const previous=job.apiPayload || job.apiOptions;
      if (previous?.aspectRatio===current.aspectRatio && previous?.size===current.size) return job;
      const next={...job,apiOptions:{...(job.apiOptions || current),aspectRatio:current.aspectRatio,size:current.size},error:''};
      if (job.apiPayload) {
        next.apiRequestHistory=[...(job.apiRequestHistory || []),{payload:JSON.parse(JSON.stringify(job.apiPayload)),submittedAt:job.submittedAt ?? null,error:job.error || ''}];
        next.apiPayload={...job.apiPayload,aspectRatio:current.aspectRatio,size:current.size};
      }
      delete next.submittedAt;
      return next;
    });
  }
  function gmResponse(request, details, timeoutMs, timers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}) {
    return new Promise((resolve,reject)=>{
      let settled=false,control;
      const finish=(action,value)=>{if (settled) return;settled=true;timers.clear(timer);action(value);};
      const fail=()=>finish(reject,new Error('공식 API 네트워크·시간 초과 오류. 제출 결과가 불명확하면 자동 재제출하지 않습니다.'));
      const timer=timers.set(()=>{fail();try {control?.abort();} catch {}},timeoutMs);
      try {control=request({...details,anonymous:true,fetch:true,redirect:'error',onload:value=>finish(resolve,value),onerror:fail,onabort:fail,ontimeout:fail});}
      catch {fail();}
    });
  }
  function apiValidationDetails(responseText) {
    let body;try {body=JSON.parse(responseText);} catch {return '';}
    if (!body || typeof body!=='object' || Array.isArray(body)) return '';
    // Return structured validation metadata only. Never echo message/input/value,
    // which may contain the complete request, prompt, or credential.
    const roots=[body,body.error,body.message,body.data].filter(value=>value && typeof value==='object' && !Array.isArray(value));
    const records=roots.flatMap(value=>[value,...['detail','details','issues','errors'].flatMap(name=>Array.isArray(value[name]) ? value[name].slice(0,10) : [])]);
    const fields=new Set(['body','query','modelVersionId','modelId','prompt','negativePrompt','aspectRatio','size','batchSize','seed','mode','style','type','key','custom','loras','weight','triggerWords','sampling','method','steps','cfgScale','scheduler','promptHelper','callbackUrl']);
    const codes=new Set(['VALIDATION','VALIDATION_ERROR','INVALID_ARGUMENT','INVALID_REQUEST','UNPROCESSABLE_ENTITY','UNPROCESSABLE_CONTENT','BAD_REQUEST','missing','invalid_type','invalid_union','invalid_value','invalid_enum_value','too_small','too_big','extra_forbidden','string_type','string_too_short','string_too_long','int_type','int_parsing','int_from_float','float_type','float_parsing','list_type','dict_type','literal_error','enum','greater_than','greater_than_equal','less_than','less_than_equal','json_invalid','value_error','validation']);
    const found=new Set();
    for (const item of records.slice(0,30)) {
      if (!item || typeof item!=='object' || Array.isArray(item)) continue;
      const code=[item.code,item.type,item.error].find(value=>codes.has(value));
      const location=item.loc ?? item.path ?? item.property;
      const segments=Array.isArray(location) ? location : typeof location==='string' ? location.split(/[/.]/).filter(Boolean) : [];
      const path=segments.length && segments.length<=8 ? segments.map(value=>fields.has(value) ? value : (typeof value==='number' && Number.isInteger(value) && value>=0 && value<=10) ? String(value) : '[기타 필드]').join('.') : '';
      if (path || code) found.add([path,code].filter(Boolean).join(' · '));
    }
    return [...found].slice(0,6).join('; ');
  }
  function apiServerReason(responseText,context={}) {
    let body;try {body=JSON.parse(responseText);} catch {return '';}
    const raw=body?.message;
    if (typeof raw!=='string' || raw.length>2000) return '';
    // Only the top-level message is considered, never request/input/data dumps.
    // Redact known credentials and all string leaves of the request before display.
    const hidden=[context.secret].filter(Boolean);
    const collect=value=>{if (typeof value==='string' && value) hidden.push(value);else if (value && typeof value==='object') Object.values(value).forEach(collect);};
    collect(context.payload);
    let result=raw;
    for (const value of hidden.sort((a,b)=>b.length-a.length)) {
      for (const variant of new Set([value,JSON.stringify(value).slice(1,-1),encodeURIComponent(value)])) result=result.split(variant).join('[가림]');
    }
    if (/authorization|api.?key|access.?token|\bbearer\b|\bprompt\b|negativePrompt/i.test(result)) return '서버 사유에 인증·프롬프트 정보가 포함될 수 있어 내용을 생략했습니다.';
    result=result.replace(/https?:\/\/\S+/gi,'[주소 가림]').replace(/[A-Za-z0-9_\-]{24,}/g,'[값 가림]').replace(/[\x00-\x1f]/g,' ');
    return result.slice(0,300);
  }
  function apiHttpError(status,method,responseText,context) {
    const advice={400:'입력값·모델/LoRA 버전과 모드 호환성을 확인해 주세요.',401:'API 키 인증 실패입니다. 키를 다시 연결해 주세요.',403:'이 키의 접근 권한을 확인해 주세요.',404:'작업·모델·미디어를 찾지 못했습니다. 키 유효성은 이 응답으로 판정하지 않습니다.',422:'API 입력값을 확인해 주세요.',429:'API 대기열·요청 제한입니다. 추가 제출을 멈췄습니다.'};
    const details=[400,422].includes(status) ? apiValidationDetails(responseText) : '';
    const reason=[400,422].includes(status) && context ? apiServerReason(responseText,context) : '';
    return Object.assign(new Error(`공식 API 오류 (${status}). ${advice[status] || '같은 작업 ID를 보존합니다. 제출 결과가 불명확하면 재제출하지 않습니다.'}${details ? '\n서버 검증: '+details : ''}${reason ? '\n서버 사유: '+reason : ''}`),
      {status,notSubmitted:method==='POST' && [400,401,403,404,422].includes(status)});
  }
  function createOfficialApiClient(request,getKey,timers) {
    async function json(method,path,payload) {
      if (!((method==='POST' && path==='/v2/image/create') || (method==='GET' && /^\/v1\/(?:task|media)\/\d+$/.test(path)))) throw new Error('허용되지 않은 공식 API 경로입니다.');
      if (typeof request!=='function') throw Object.assign(new Error('최신 Tampermonkey로 업데이트하고 스크립트의 API 접근 권한을 허용해 주세요.'),{notSubmitted:true});
      let key;try {key=getKey();} catch(error) {error.notSubmitted=true;throw error;}
      const response=await gmResponse(request,{method,url:'https://api.pixai.art'+path,responseType:'text',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(payload ? {data:JSON.stringify(payload)} : {})},30000,timers);
      if (response.finalUrl && response.finalUrl!=='https://api.pixai.art'+path) throw new Error('공식 API의 예상하지 못한 이동 응답입니다.');
      if ((method==='POST' && response.status!==201) || (method==='GET' && response.status!==200)) throw apiHttpError(response.status,method,response.responseText,{secret:key,payload});
      try {const value=JSON.parse(response.responseText);if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error();return value;}
      catch {throw new Error('공식 API 응답 형식을 확인하지 못했습니다. 자동 재제출하지 않습니다.');}
    }
    return {async create(payload){const task=await json('POST','/v2/image/create',payload);if (typeof task.id!=='string' || !/^\d+$/.test(task.id)) throw new Error('공식 API 작업 ID를 확인하지 못했습니다. 자동 재제출하지 않습니다.');return task.id;},
      task:id=>json('GET','/v1/task/'+presetIdentifier(id,'작업',true)),media:id=>json('GET','/v1/media/'+presetIdentifier(id,'미디어',true)),
      async image(url){const allowed=mediaUrlAllowed(url);if (allowed.username || allowed.password || allowed.port) throw new Error('이미지 주소 형식을 확인해 주세요.');
        const response=await gmResponse(request,{method:'GET',url:allowed.href,responseType:'blob'},90000,timers);
        if (response.finalUrl && mediaUrlAllowed(response.finalUrl).origin!==allowed.origin) throw new Error('이미지 서버 이동으로 저장을 중단했습니다.');
        if (response.status!==200) throw apiHttpError(response.status,'GET');return response.response;}
    };
  }
  // 서버가 알려준 원본 크기와 실제 내려받은 이미지 크기가 다르면(미리보기 등) 저장하지 않는다.
  async function assertOriginalDimensions(blob, expected, decode) {
    if (!expected.width || !expected.height) return;
    let bitmap;
    try { bitmap = await decode(blob); } catch { throw new Error("다운로드한 이미지를 해석하지 못해 원본 여부를 확인할 수 없습니다. 저장하지 않습니다."); }
    try {
      if (bitmap.width !== expected.width || bitmap.height !== expected.height) throw new Error("다운로드한 이미지 크기(" + bitmap.width + "×" + bitmap.height + ")가 원본(" + expected.width + "×" + expected.height + ")과 다릅니다. 미리보기일 수 있어 저장하지 않습니다.");
    } finally { if (typeof bitmap?.close === "function") bitmap.close(); }
  }

  function queueHistory(job) {return ['done','skipped'].includes(job.state);}
  function queueJobRemovable(job) {
    return job.state==='done' || (['queued','skipped'].includes(job.state) && !job.taskId && !job.submittedAt && !job.saved?.length && !job.mediaIds?.length && !job.metadataFile && !['unknown','submitting','waiting','saving','save_failed'].includes(job.skippedFrom));
  }
  function changeQueueRecords(jobs,ids,action) {
    if(!['delete','archive'].includes(action))throw new Error('지원하지 않는 대기열 변경입니다.');
    const selected=new Set(ids),targets=jobs.filter(job=>selected.has(job.id));
    if(!selected.size || targets.length!==selected.size)throw new Error('목록이 변경됐습니다. 다시 선택해 주세요.');
    if(targets.some(job=>!queueJobRemovable(job) || (action==='archive' && queueHistory(job))))throw new Error('제출된 미완료 작업·결과 확인이 필요한 작업은 지울 수 없습니다. 먼저 같은 작업을 재개해 저장해 주세요.');
    return action==='delete' ? jobs.filter(job=>!selected.has(job.id)) : jobs.map(job=>selected.has(job.id) ? {...job,state:'skipped',skippedFrom:job.state} : job);
  }

  const core = {BACKUP_CATEGORIES,BACKUP_LABELS,backupSelection,backupFolderChoices,backupSelectionLabels,selectBackupLibrary,makeTransferBackup,parseTransferBackup,prepareBackupImport,filterQueueJobs,jobBatch,readPublicModelName,prepareImageForSave,createSceneThumbnailCache,atomicRecordWrite,subsetRegisteredLibrary,changeSceneCards,readImageInfo,embedGenerationInfo,imageCrc,inspectImageContainer,importImageComposition,importedImagePreset,compatibleSettings,resolvePresetCommon,deleteCommonPreset,normalizeBatchPlan,makeSceneCard,refreshSceneCard,resolveBatchRow,expandBatchPlan,appendBatchReservations,parsePublicModelLink,imageInfoFields,submitJob,runQueue,placeLibraryItem,MEDIA_QUERY,pickOriginalMedia,mediaUrlAllowed,assertOriginalDimensions,describeQueryFailure,graphqlQuery,snapshotCombination,rememberCombination,resolveCombination,paneRatios,resizePanePair,bindPaneResize,bindWindowResize,createChunkFolder,materialIcon,makePresetLibrary, validatePresetConfiguration, normalizePresetLibrary, orderedChunks, moveLibraryItem, moveChunksTo, removeChunks, duplicateChunks, removeChunkFolder, normalizeSettingsOptions, makeSettingsBackup, parseSettingsBackup, createSettingsStore, composePresetPrompts, expandPresetReservations, parseModelLink, assertConfiguration, assertNumberField, readLoraTriggerWords, capturePresetSettings, createPixaiSettingsAdapter, mountPresetEditor, readPromptEditorText, normalize, safeName, recover, verifyTask, outputIds, processJob, checkCost, clampPosition, bindPanelDrag, acceptFolder, folderError, bindFolderActivation, pickDirectory, storageSupport, downloadError, managedDownload, resetDownloadProgress};
  Object.assign(core,{UPDATE_URLS,updateChannelUrl,updateChannelInfo,queueHistory,queueJobRemovable,changeQueueRecords,API_RATIOS,API_STYLES,normalizeComposeDraft,normalizeReservationImageOptions,normalizeApiOptions,buildApiPayload,reconfigureQueuedApiJob,applyQueuedImageOptions,createSessionApiKey,createRememberedApiKey,gmResponse,apiValidationDetails,apiServerReason,apiHttpError,createOfficialApiClient});
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  if (window.top !== window.self || location.hostname !== 'pixai.art') return;
  const KEY = 'local.pixai-web-queue.v1';
  const LIBRARY_KEY = 'local.pixai-web-queue.presets.v1';
  const OPTIONS_KEY = 'local.pixai-web-queue.options.v1';
  const COMPOSE_DRAFT_KEY = 'local.pixai-web-queue.compose.v1';
  const API_COST_ACK_KEY = 'local.pixai-web-queue.api-cost-ack.v1';
  const PREVIOUS_SETTINGS_KEY = 'local.pixai-web-queue.before-import.v1';
  const LOCK = 'local.pixai-web-queue.runner.v1';
  const LABELS = {queued:'대기', submitting:'제출 중', waiting:'완료 확인', saving:'저장 중', save_failed:'저장 재시도 필요', done:'저장 완료', unknown:'제출 결과 확인 필요', skipped:'건너뜀'};
  let jobs = [];
  let folder = null;
  let folderToken = null;
  let rememberedFolder = null;
  let folderEpoch = 0;
  let folderRestoration = Promise.resolve();
  let restoringFolder = false;
  let running = false;
  let oneJobRun = false; // true while a 「첫 작업만 실행」 run holds the queue
  let starting = false;
  let stopRequested = false;
  let internalAction = false;
  let runImageCount = null;
  let settingsBusy = false;
  const sceneThumbnails=createSceneThumbnailCache({load:()=>localStorage.getItem(LIBRARY_KEY+'.scene-thumbnails.v1'),save:value=>localStorage.setItem(LIBRARY_KEY+'.scene-thumbnails.v1',value)});
  let presetEditor;
  let panel;
  const apiKey=createSessionApiKey();
  const rememberedKey=createRememberedApiKey(apiKey,typeof GM_getValue==='function' && typeof GM_setValue==='function' && typeof GM_deleteValue==='function' ? {get:GM_getValue,set:GM_setValue,remove:GM_deleteValue} : null);
  let apiOptions=normalizeApiOptions();
  function currentApiOptions() {const {batchSize,...images}=presetEditor?.getImageOptions?.() || {};return normalizeApiOptions({...apiOptions,...images});}
  function currentApiBatchSize() {return presetEditor?.getImageOptions?.().batchSize || Number(panel.querySelector('[data-image-count]')?.value) || 1;}
  const api=createOfficialApiClient(typeof GM_xmlhttpRequest==='function' ? GM_xmlhttpRequest : null,()=>apiKey.get());
  window.addEventListener('pagehide',()=>apiKey.clear());
  let choosingFolder = false;
  const download = typeof GM_download === 'function' ? GM_download : null;
  const storage = storageSupport(window, download, typeof GM_info === 'object' ? GM_info : null);
  let downloadsReady = false;
  let message = storage.message;
  try {rememberedKey.restore();} catch(error) {message=error.message;}
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const visible = element => element && element.getClientRects().length > 0;
  const onGenerator = () => /^\/(?:[a-z]{2}\/)?generator\/image\/?$/.test(location.pathname);
  const modelId = () => settings.modelKey();
  const settings = createPixaiSettingsAdapter(document, {
    win:window, sleep,
    check:() => { if (!onGenerator()) throw new Error('PixAI 한국어 새 이미지 생성 화면에서 실행해 주세요.'); if ((running || starting || settingsBusy) && stopRequested) throw new Error('설정 적용이 중지됐습니다.'); },
    mutate:action => { internalAction=true; try {return action();} finally {internalAction=false;} }
  });
  function readLibrary() { return normalizePresetLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) || JSON.stringify(makePresetLibrary()))); }
  function withLibraryLock(run){if(!navigator.locks)throw Error('이 브라우저는 라이브러리 중복 저장 방지를 지원하지 않습니다.');return navigator.locks.request(LIBRARY_KEY+'.edit',{},lock=>{if(!lock)throw Error('다른 탭에서 라이브러리 작업 중입니다.');return run();});}
  function saveLibrary(value,expected){return withLibraryLock(()=>{const previous=localStorage.getItem(LIBRARY_KEY);if(expected&&JSON.stringify(readLibrary())!==JSON.stringify(normalizePresetLibrary(expected)))throw Error('다른 탭에서 라이브러리가 바뀌었습니다. 다시 읽거나 편집 내용을 복제해 저장해 주세요.');const normalized=normalizePresetLibrary(value);if(previous&&!localStorage.getItem(LIBRARY_KEY+'.pre-0.10'))localStorage.setItem(LIBRARY_KEY+'.pre-0.10',previous);localStorage.setItem(LIBRARY_KEY,JSON.stringify(normalized));});}
  async function settingsAction(action, {readOnly = false} = {}) {
    if (running || starting || settingsBusy) throw new Error('실행 중인 작업이 끝난 뒤 설정을 편집해 주세요.');
    settingsBusy=true; stopRequested=false; render();
    try { return await (readOnly ? action() : locked(()=>withLibraryLock(action))); } finally {settingsBusy=false;render();}
  }
  function load() {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{"version":1,"jobs":[]}');
    if (stored.version !== 1 || !Array.isArray(stored.jobs)) throw new Error('대기열 형식이 맞지 않습니다.');
    jobs = recover(stored.jobs);
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify({version:1, jobs}));
    render();
  }
  // Queue additions from this tab: while its runner holds the queue lock, `jobs` is the live array the
  // runner iterates, so append in place; otherwise take the lock and reload before changing anything.
  async function queueEdit(action) {
    if (starting || settingsBusy) throw new Error('시작 준비·설정 확인이 끝난 뒤 대기열에 등록해 주세요.');
    if (running) return action();
    return locked(action);
  }
  async function locked(action) {
    if (!navigator.locks) throw new Error('이 브라우저는 중복 실행 방지 기능을 지원하지 않습니다.');
    return navigator.locks.request(LOCK, {ifAvailable:true}, async lock => {
      if (!lock) throw new Error('다른 PixAI 탭에서 대기열이 실행 중입니다.');
      load();
      return action();
    });
  }
  async function getTask(id) { return api.task(id); }
  function groupName(element) {
    return element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ');
  }
  function expectedCount() {
    return settings.readImageCount();
  }
  async function ensureDestination() {
    let reason='';
    if (!storage.supported) reason=storage.message;
    else if (storage.mode === 'download') {
      if (!downloadsReady) reason='먼저 설정 탭의 자동 다운로드 준비 확인을 완료해 주세요.';
    } else if (!folder || await folder.queryPermission({mode:'readwrite'}) !== 'granted') {
      if (folder) { rememberedFolder={handle:folder,token:folderToken};folder=null;folderToken=null; }
      reason='설정 탭의 저장 폴더 선택을 눌러 쓰기 권한을 허용해 주세요. 새로고침한 뒤에는 다시 선택해야 합니다.';
    }
    if (reason) throw Object.assign(new Error(reason),{requiresStorageSetup:true});
  }
  async function prepare(job) {
    if (stopRequested) throw new Error('다음 작업 제출이 중지됐습니다.');
    apiKey.get();
    await ensureDestination();
    if (job.maxCredits!=null && !panel.querySelector('[data-api-cost-ack]').checked) throw new Error('공식 API는 이 스크립트의 크레딧 상한을 적용할 수 없습니다. 설정 탭에서 이를 확인한 뒤 실행해 주세요.');
    if (!job.apiPayload && !job.configuration && !(job.apiOptions || apiOptions).modelVersionId) {
      job.configuration=await settings.capture();job.negativePrompt=await settings.captureNegative();
    }
    const payload=job.apiPayload || buildApiPayload(job,job.apiOptions || currentApiOptions(),job.apiBatchSize || runImageCount,crypto.getRandomValues(new Uint32Array(1))[0]);
    return {backend:'official-api',queryBackend:'official-v1',apiPayload:payload,expected:payload.batchSize,
      budgetEnforcement:'unavailable; acknowledged at start',appliedConfiguration:job.configuration || {model:{versionId:payload.modelVersionId},loras:payload.loras},appliedNegativePrompt:payload.negativePrompt};
  }
  async function submit(job) {
    if (stopRequested) throw Object.assign(new Error('제출 직전 중지됐습니다. 이미지를 생성하지 않았습니다.'),{notSubmitted:true});
    return api.create(job.apiPayload);
  }
  async function waitTask(job) {
    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      const task = await getTask(job.taskId);
      job.queryBackend="official-v1";
      verifyTask(job, task);
      const status = String(task.status).toLowerCase();
      if (['completed','succeeded','success','done'].includes(status)) return task;
      if (!['waiting','running','pending','processing','queued'].includes(status)) {
        throw new Error(`생성 상태: ${status}. 해당 작업을 사이트에서 확인해 주세요.`);
      }
      if (stopRequested) throw new Error('대기열 중지됨. 서버 작업은 유지되며 같은 ID로 다시 확인합니다.');
      await sleep(5000);
    }
    throw new Error('완료 확인 시간 초과. 같은 작업 ID로 재개할 수 있습니다.');
  }
  async function imageBlob(mediaId) {
    const media=await api.media(mediaId);
    const original=pickOriginalMedia(media,mediaId);
    const blob=await api.image(original.url);
    if (!['image/png','image/jpeg','image/webp'].includes(blob?.type) || blob.size===0) throw new Error('다운로드한 파일이 지원 이미지가 아닙니다.');
    await assertOriginalDimensions(blob,original,image=>createImageBitmap(image));
    return blob;
  }
  async function writeNew(name, data) {
    if (storage.mode === 'download') {
      if (!storage.supported) throw new Error(storage.message);
      const blob = data instanceof Blob ? data : new Blob([data],{type:'application/json'});
      return managedDownload(download, blob, name);
    }
    // Never replace an existing filename, including a file left by an interrupted save.
    for (let suffix = 0; suffix < 10000; suffix++) {
      const candidate = suffix ? name.replace(/(\.[^.]+)$/, `_${suffix}$1`) : name;
      try { await folder.getFileHandle(candidate); continue; }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      const handle = await folder.getFileHandle(candidate, {create:true});
      const writable = await handle.createWritable();
      try { await writable.write(data); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch {} throw error; }
      const actual = await handle.getFile();
      const bytes = data instanceof Blob ? data.size : new TextEncoder().encode(data).length;
      if (actual.size !== bytes) throw new Error('저장된 파일 크기가 일치하지 않습니다.');
      return candidate;
    }
    throw new Error('저장 파일명 충돌이 너무 많습니다.');
  }
  const io = {
    persist, prepare, submit, waitTask,
    async saveImage(job, mediaId, index) {
      await ensureDestination();
      job.folderToken = folderToken;
      persist(); // Bind saved progress to this folder even if remembering the handle failed.
      let blob = await imageBlob(mediaId);
      blob=await prepareImageForSave(blob,job,mediaId,persist);
      const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type];
      const name=await writeNew(`${safeName(job.title)}_${job.taskId}_${index+1}_${mediaId}.${extension}`,blob);
      await sceneThumbnails.remember(job.composition?.reservation?.sourceSceneId,blob);try{presetEditor?.refresh();}catch{message='이미지는 저장했습니다. 라이브러리 화면 갱신은 다시 시도해 주세요.';}return name;
    }
  };
  async function start({oneJob=false}={}) {
    if (running || starting) return;
    if (settingsBusy) throw new Error('모델·LoRA 설정 확인이 끝난 뒤 시작해 주세요.');
    if (choosingFolder) throw new Error(storage.mode === 'download' ? '확인 파일 다운로드가 끝난 뒤 시작해 주세요.' : '폴더 선택창을 먼저 닫거나 선택을 완료해 주세요.');
    starting=true; stopRequested=false; message='시작 준비: 저장 위치 확인 중…';render();
    let showStorage=false;
    try {
    await folderRestoration;
    await ensureDestination();
    if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    await locked(async () => {
      await ensureDestination();
      if (!jobs.some(job => !['done','skipped'].includes(job.state))) throw new Error('대기열이 비어 있습니다. 프롬프트를 입력하고 대기열 추가를 눌러 주세요.');
      if (storage.mode === 'folder' && jobs.some(job => job.saved?.length && !['done','skipped'].includes(job.state) && job.folderToken !== folderToken)) {
        throw new Error('부분 저장 작업의 폴더를 다시 선택해 확인해 주세요.');
      }
      apiKey.get();
      const pendingJobs=jobs.filter(job=>!['done','skipped'].includes(job.state));
      const newJobs=(oneJob ? pendingJobs.slice(0,1) : pendingJobs.some(job=>job.state!=='queued') ? [] : pendingJobs).filter(job=>job.state==='queued');
      if (newJobs.length && !panel.querySelector('[data-api-cost-ack]').checked) {
        throw new Error('설정 탭에서 공식 API 과금·비용 상한 미지원 안내를 확인해 주세요. 기존 작업 조회만 재개할 때는 필요하지 않습니다.');
      }
      const needsSite=newJobs.some(job=>!job.apiPayload && !job.configuration && !(job.apiOptions || apiOptions).modelVersionId);
      if (needsSite) {
        message='기본 모델 미지정: 사이트 설정을 읽는 중…';render();
        const baseline=await settings.capture(),negative=await settings.captureNegative();
        for (const job of newJobs.filter(item=>!item.apiPayload && !item.configuration && !(item.apiOptions || apiOptions).modelVersionId)) {
          Object.assign(job,{configuration:JSON.parse(JSON.stringify(baseline)),negativePrompt:negative,settingsOrigin:'site-at-first-api-start'});
        }
      }
      if (storage.mode === 'download') resetDownloadProgress(jobs);
      const selectedCount=currentApiBatchSize();
      runImageCount=selectedCount || (newJobs.length ? expectedCount() : 1);
      const payloads=newJobs.filter(item=>!item.apiPayload).map(job=>[job,buildApiPayload(job,job.apiOptions || currentApiOptions(),job.apiBatchSize || runImageCount,crypto.getRandomValues(new Uint32Array(1))[0])]);
      for (const [job,payload] of payloads) job.apiPayload=payload;
      persist(); // Freeze all new payloads before the first paid request.
      if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
      running = true;
      starting = false;
      oneJobRun = oneJob;
      try {
        persist();
        await runQueue(jobs,io,{limit:Number(panel.querySelector('[data-max-in-flight]').value),oneJob,stopped:()=>stopRequested});
        message = stopRequested ? '중지됨. 완료된 파일은 보존했습니다.' : oneJob ? '첫 작업 실행과 저장이 끝났습니다. 나머지 대기열은 실행하지 않았습니다.' : '대기열 작업과 저장이 끝났습니다.';
      } finally { running = false; render(); }
    });
    } catch(error) {
      if (error.requiresStorageSetup) {
        showStorage=true;
        presetEditor?.showPage('settings',true);
      }
      throw error;
    } finally {starting=false;render();if (showStorage) panel?.querySelector('[data-choose-folder]')?.focus({preventScroll:true});}
  }
  function node(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    return element;
  }
  function button(text, action) {
    const element = node('button', text, {type:'button'});
    bindFolderActivation(element, () => element, () => {
      if (element.getAttribute('data-view-only') == null) {
        notifyAction(`입력 확인: ${text}`);
      }
      return action();
    }, error => { message = error.message; render(); });
    return element;
  }
  let notificationTimer;
  const expandedJobs=new Set(),selectedJobs=new Set();
  const queueViewingKey=KEY+'.view',queueViewing=readGroupView(localStorage,queueViewingKey);let queueView=queueViewing.view||'active',queueState=queueViewing.state||'',queueBatch=queueViewing.batch||'',queueConfirmation=null;
  const openedBatches=new Set(queueViewing.opened||[]);const persistQueueView=()=>{try{localStorage.setItem(queueViewingKey,JSON.stringify({view:queueView,state:queueState,batch:queueBatch,opened:[...openedBatches]}));}catch{notifyAction('목록 보기 저장 실패 · 현재 화면은 유지합니다.');}};
  async function confirmQueueChange() {
    if(running || starting || settingsBusy)throw new Error('실행을 중지한 뒤 목록을 정리해 주세요.');
    const request=queueConfirmation;if(!request)return;
    await locked(()=>{
      const before=jobs;const next=changeQueueRecords(jobs,request.ids,request.action);
      jobs=next;
      try {persist();} catch(error) {jobs=before;throw error;}
    });
    queueConfirmation=null;selectedJobs.clear();
    if(request.action==='archive')queueView='active';
    message=request.action==='archive' ? `${request.ids.length}개를 보관했습니다. 새 작업을 등록해 주세요. 기록에서 건너뛰기 취소로 복원할 수 있습니다.` : `${request.ids.length}개 목록을 삭제했습니다. 저장된 이미지·프리셋·청크는 유지됩니다.`;
    render();
  }
  function notifyAction(text) {
    if (!panel) return;
    const toast=panel.querySelector('[data-toast]');if (!toast) return;
    toast.textContent=text;toast.hidden=false;clearTimeout(notificationTimer);
    notificationTimer=setTimeout(()=>{toast.hidden=true;},7000);
  }
  function render() {
    if (!panel) return;
    presetEditor?.refreshImageOptions?.();
    const rememberControl=panel.querySelector('[data-remember-api-key]');
    if(rememberControl)rememberControl.disabled=!rememberedKey.supported || running || starting || settingsBusy;
    const keyStatus=panel.querySelector('[data-api-key-state]');
    if (keyStatus) keyStatus.textContent=rememberedKey.status()==='unknown' ? '키 저장 상태 확인 필요 · 저장된 키를 삭제하고 다시 연결해 주세요' : apiKey.has() ? `키 입력됨 · ${rememberedKey.status()==='saved' ? '스크립트 관리자에 저장됨' : '이 탭에서만 보관'} · 인증 확인은 별도 조회로 진행` : rememberedKey.status()==='saved' ? '저장된 키 있음 · 이 탭 연결 해제됨 · 키를 다시 입력하거나 저장된 키를 삭제해 주세요' : 'API 키 미입력 · 설정에서 연결해 주세요';
    const launcher=panel.querySelector('[data-launcher]');
    if (launcher) launcher.title=`클릭해 PixAI 대기열 열기 · 드래그해 이동 · ${running ? '실행 중' : starting ? '시작 준비 중' : settingsBusy ? '설정 확인 중' : '대기'}\n${message}`;
    panel.querySelector('[data-message]').textContent = message;
    const feedback=panel.querySelector('[data-action-message]');
    if (feedback) feedback.textContent=message;
    panel.querySelector('[data-folder]').textContent = storage.mode === 'download'
      ? `자동 다운로드 · ${downloadsReady ? '준비 확인 완료' : '준비 확인 필요'} · 브라우저 설정 폴더`
      : (folder ? `저장 폴더: ${folder.name}` : rememberedFolder ? `기억한 폴더: ${rememberedFolder.handle.name} · 권한 허용 필요` : restoringFolder ? '이전 저장 폴더 확인 중…' : '저장 폴더 미선택');
    const list = panel.querySelector('[data-jobs]');
    list.replaceChildren();
    const visible=filterQueueJobs(jobs,{view:queueView,state:queueState,batch:queueBatch});
    for(const id of selectedJobs)if(!visible.some(job=>job.id===id))selectedJobs.delete(id);
    const toolbar=node('div',null,{class:'pq-queue-toolbar'});
    for(const [view,title] of [['active','진행 대기열'],['history','완료·보관 기록']]) {
      const tab=button(`${title} (${jobs.filter(job=>queueHistory(job)===(view==='history')).length})`,()=>{queueView=view;queueState='';persistQueueView();selectedJobs.clear();queueConfirmation=null;render();});
      tab.setAttribute('aria-pressed',String(queueView===view));tab.setAttribute('data-queue-view',view);toolbar.append(tab);
    }
    const filters=node('details');filters.append(node('summary',`목록 필터 · ${queueState?LABELS[queueState]:'전체 상태'} · ${queueBatch?'묶음 선택':'전체 묶음'}`));
    for(const [state,label] of [['','전체 상태'],...Object.entries(LABELS)]){const control=button(label,()=>{queueState=state;persistQueueView();selectedJobs.clear();queueConfirmation=null;render();});control.setAttribute('data-view-only','');control.setAttribute('aria-pressed',String(queueState===state));filters.append(control);}
    const batches=[...new Map(jobs.filter(v=>jobBatch(v)).map(v=>[jobBatch(v).id,jobBatch(v)])).values()];
    for(const [id,label] of [['','전체 묶음'],['ungrouped','개별 작업'],...batches.map(v=>[v.id,v.name])]){const control=button(label,()=>{queueBatch=id;persistQueueView();selectedJobs.clear();queueConfirmation=null;render();});control.setAttribute('data-view-only','');control.setAttribute('aria-pressed',String(queueBatch===id));filters.append(control);}toolbar.append(filters);
    const selectable=visible.filter(queueJobRemovable);
    const selectAll=button('전체 선택',()=>{for(const job of selectable)selectedJobs.add(job.id);queueConfirmation=null;render();});
    const deselect=button('선택 해제',()=>{selectedJobs.clear();queueConfirmation=null;render();});
    const requestChange=(ids,action)=>{if(running || starting || settingsBusy)throw new Error('실행을 중지한 뒤 목록을 정리해 주세요.');changeQueueRecords(jobs,ids,action);queueConfirmation={ids,action};render();};
    const removeSelected=button(`선택 삭제 (${selectedJobs.size})`,()=>requestChange([...selectedJobs],'delete'));
    const removeAll=button('현재 목록 전체 삭제',()=>requestChange(selectable.map(job=>job.id),'delete'));
    const fresh=button('새 대기열',()=>requestChange(jobs.filter(job=>!queueHistory(job)).map(job=>job.id),'archive'));
    for(const control of [selectAll,deselect,removeSelected,removeAll,fresh])control.dataset.edit='';
    removeSelected.setAttribute('data-unavailable',String(!selectedJobs.size));removeAll.setAttribute('data-unavailable',String(!selectable.length));
    fresh.setAttribute('data-unavailable',String(!jobs.some(job=>!queueHistory(job))));
    toolbar.append(selectAll,deselect,removeSelected,removeAll,fresh,node('small','완료 항목은 기록으로 이동합니다. 새 대기열은 미제출 항목을 보관합니다. 제출된 미완료 작업은 삭제하지 않습니다.'));
    if(queueConfirmation) {
      const box=node('div',null,{class:'pq-queue-confirm','role':'alert'});
      box.append(node('strong',queueConfirmation.action==='archive' ? `미제출 ${queueConfirmation.ids.length}개를 기록으로 옮길까요?` : `${queueConfirmation.ids.length}개 목록을 영구 삭제할까요? 저장된 이미지 파일은 유지됩니다.`));
      const yes=button('확인하고 적용',confirmQueueChange);yes.dataset.edit='';
      box.append(yes,button('취소',()=>{queueConfirmation=null;render();}));toolbar.append(box);
    }
    list.append(toolbar);
    if(!visible.length) {
      list.append(node('small',queueView==='history' ? '완료·보관 기록이 없습니다.' : '대기열이 비었습니다. 새 조합을 등록해 주세요.'));
      if (queueView!=='history' && presetEditor) {
        const compose=node('button','조합 예약으로 가기',{type:'button','data-go-compose':''});decorateIcon(compose,'playlist_add');
        compose.addEventListener('click',()=>presetEditor.showPage('compose',true));list.append(compose);
      }
    }
    const groupedParents=new Map();
    for (const job of visible) {
      const batch=jobBatch(job);let parent=list;
      if(batch){let group=groupedParents.get(batch.id);if(!group){group=node('details',null,{class:'pq-batch-group'});group.open=openedBatches.has(batch.id);group.append(node('summary',`${batch.name} · ${visible.filter(v=>jobBatch(v)?.id===batch.id).length}개 작업`));const permitted=visible.filter(v=>jobBatch(v)?.id===batch.id&&queueJobRemovable(v)),remove=button('이 묶음의 삭제 가능한 목록 제외',()=>requestChange(permitted.map(v=>v.id),'delete'));remove.dataset.edit='';remove.dataset.unavailable=String(!permitted.length);group.append(remove,node('small','현재 필터에서 삭제 가능한 항목만 제외합니다. 제출된 미완료 작업과 저장된 원본은 유지됩니다.'));group.addEventListener('toggle',()=>{if(group.open)openedBatches.add(batch.id);else openedBatches.delete(batch.id);persistQueueView();});groupedParents.set(batch.id,group);list.append(group);}parent=group;}
      const row = node('div', null, {class:'pq-job','data-queue-job':job.id});
      const selection=node('label',null,{class:'pq-check-label'}),check=node('input',null,{type:'checkbox','aria-label':`작업 선택: ${job.title}`,'data-select-job':job.id});
      check.checked=selectedJobs.has(job.id);check.disabled=running || starting || settingsBusy || !queueJobRemovable(job);
      check.addEventListener('change',()=>{if(check.disabled)return;if(check.checked)selectedJobs.add(job.id);else selectedJobs.delete(job.id);queueConfirmation=null;render();});
      selection.append(check,node('strong',job.title));row.append(selection);
      if(!queueJobRemovable(job))row.append(node('small','복구 필요 · 삭제 보호'));
      row.append(node('span', `${LABELS[job.state]}${job.expected ? ` · ${job.saved?.length || 0}/${job.expected}` : ''}`));
      const imageOptions=job.apiPayload || job.apiOptions;
      if (imageOptions?.aspectRatio) {
        row.append(ratioMark(node,imageOptions.aspectRatio),node('small',`적용 비율 ${imageOptions.aspectRatio} ${ratioDescription(imageOptions.aspectRatio)} (가로:세로) · 크기 ${imageOptions.size || '1k'} · ${imageOptions.batchSize||job.apiBatchSize||1}장 · ${imageOptions.mode||'모델 기본값'}`));
        const current=currentApiOptions();
        if (job.state==='queued' && !job.taskId && (imageOptions.aspectRatio!==current.aspectRatio || imageOptions.size!==current.size)) row.append(node('small',`현재 설정 ${current.aspectRatio} · ${current.size}과 다릅니다. 조합 예약에서 대기 작업에 비율·크기를 적용할 수 있습니다.`));
      } else if (job.state==='queued' && !job.taskId) {const current=currentApiOptions();row.append(node('small',`시작 시 현재 설정 ${current.aspectRatio} (가로:세로) · ${current.size} 적용 예정`));}
      if (job.error) row.append(node('small', job.error));
      for(const warning of [...new Set(Object.values(job.metadataWarnings||{}))])row.append(node('small',`PNG 기록 경고: ${warning}`,{role:'note'}));
      if(batch)row.append(node('small',`${batch.rowName} × ${batch.columnName}`));
      if (job.taskId) row.append(node('small', `작업 ${job.taskId}`));
      const timeline=node('div',null,{class:'pq-job-timeline','aria-label':`진행 단계: ${job.title}`});
      const submitted=!!job.taskId,confirmed=submitted && (['saving','save_failed','done'].includes(job.state) || !!job.saved?.length || !!job.metadataFile),stored=job.state==='done';
      for (const [name,done] of [['준비',true],['제출',submitted],['생성 확인',confirmed],['저장',stored]]) timeline.append(node('span',`${done ? '✓ ' : '○ '}${name}`,{'data-complete':String(done)}));
      row.append(timeline);
      const detail=node('details',null,{class:'pq-job-detail'});detail.open=expandedJobs.has(job.id);
      detail.append(node('summary','작업 내용 보기'),node('strong','전송 프롬프트'),node('div',job.prompt,{class:'pq-job-prompt'}),node('strong','네거티브'),node('div',job.negativePrompt || '(없음)',{class:'pq-job-prompt'}));
      if (job.configuration?.model && Array.isArray(job.configuration.loras)) detail.append(node('small',`모델 ${job.configuration.model.name || job.configuration.model.id} · 버전 ${job.configuration.model.versionId}`),...job.configuration.loras.filter(lora=>lora && typeof lora==='object').map(lora=>node('small',`LoRA ${lora.name || lora.id} · ${lora.weight}`)));
      detail.addEventListener('toggle',()=>{if (detail.open) expandedJobs.add(job.id);else expandedJobs.delete(job.id);});row.append(detail);
      if (job.state==='queued' && !job.taskId && !job.saved?.length) {
        const configure=button('현재 API 옵션 적용',async()=>{
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 요청을 바꿀 수 없습니다.');
          await locked(()=>{
            const index=jobs.findIndex(item=>item.id===job.id);
            if (index<0) throw new Error('대기 작업을 찾지 못했습니다.');
            const next=reconfigureQueuedApiJob(jobs[index],currentApiOptions(),currentApiBatchSize(),crypto.getRandomValues(new Uint32Array(1))[0]);
            const before=jobs[index];jobs[index]=next;
            try {persist();} catch(error) {jobs[index]=before;throw error;}
          });
          message='이 대기 작업에 현재 API 옵션을 적용했습니다. 이전 요청 사본은 보존했고 새 생성은 하지 않았습니다.';render();
        });
        configure.setAttribute('aria-label',`현재 API 옵션 적용: ${job.title}`);configure.dataset.edit='';row.append(configure);
      }
      if (job.state === 'unknown') row.append(button('사이트 확인 후 작업 ID 연결', async () => {
        const id = window.prompt('사이트에서 해당 작업 ID를 확인하고 입력해 주세요. 새 생성은 하지 않습니다.');
        if (!id || !/^\d+$/.test(id)) return;
        await locked(async () => {
          const target = jobs.find(item => item.id === job.id);
          const task = await getTask(id);
          verifyTask({...target, taskId:id}, task);
          target.taskId = id; target.state = 'waiting'; target.error = ''; persist();
        });
      }));
      if (job.state === 'skipped') {
        const restore=button('건너뛰기 취소', async () => {
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 상태를 바꿀 수 없습니다.');
          await locked(() => {
            const target=jobs.find(item=>item.id===job.id);
            if (!target || target.state !== 'skipped') throw new Error('작업 상태가 변경됐습니다.');
            // Keep paid/uncertain submissions on their recovery path, including
            // old skipped records that predate the undo button.
            target.state=target.taskId ? 'waiting' : target.submittedAt || target.skippedFrom === 'unknown' ? 'unknown' : 'queued';
            delete target.skippedFrom;persist();
          });
          message='건너뛰기를 취소했습니다. 작업은 실행하지 않았습니다.';render();
        });
        restore.setAttribute('data-edit','');row.append(restore);
      } else if (job.state !== 'done') {
        const skip=button('건너뛰기', async () => {
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 상태를 바꿀 수 없습니다.');
          await locked(() => {
            const target=jobs.find(item=>item.id===job.id);
            if (!target || ['done','skipped'].includes(target.state)) throw new Error('작업 상태가 변경됐습니다.');
            target.skippedFrom=target.state;target.state='skipped';persist();
          });
        });
        skip.setAttribute('data-edit','');const menu=node('details',null,{class:'pq-job-menu'});menu.append(node('summary','⋮',{'aria-label':`작업 메뉴: ${job.title}`}),skip);row.append(menu);
      }
      parent.append(row);
    }
    // While this tab runs the queue, library/compose editing and registration stay open so the next batch
    // can be prepared; queue rows, legacy add, backups, folder and site-settings controls stay locked.
    const composing = running && !starting && !settingsBusy;
    for (const element of panel.querySelectorAll('[data-edit], [data-start]')) {
      const open = composing && !!presetEditor?.allowsWhileRunning(element);
      element.disabled = (!open && (running || starting || settingsBusy)) || element.getAttribute('data-unavailable') === 'true';
    }
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = running || starting || settingsBusy || choosingFolder;
    const installChannel=panel.querySelector('[data-update-install]');
    if(installChannel){const blocked=running||starting||settingsBusy||choosingFolder;installChannel.setAttribute('aria-disabled',String(blocked));installChannel.setAttribute('tabindex',blocked?'-1':'0');if(blocked)installChannel.removeAttribute('href');else installChannel.setAttribute('href',updateChannelUrl(installChannel.getAttribute('data-update-channel')));for(const control of panel.querySelectorAll('[data-update-choice]'))control.disabled=blocked;}
    choose.textContent = storage.mode === 'download'
      ? (choosingFolder ? '확인 파일 다운로드 중…' : '자동 다운로드 준비 확인')
      : (choosingFolder ? (rememberedFolder && !folder ? '권한 확인 중…' : '폴더 선택 중…') : rememberedFolder && !folder ? '저장 폴더 권한 허용' : '저장 폴더 선택');
    const chooseOther=panel.querySelector('[data-choose-other-folder]');
    const queueCounts=panel.querySelector('[data-queue-counts]');if (queueCounts) queueCounts.textContent=`진행 ${jobs.filter(job=>!queueHistory(job)).length} · 기록 ${jobs.filter(queueHistory).length} · 저장 완료 ${jobs.filter(job=>job.state==='done').length} · 확인 필요 ${jobs.filter(job=>job.error || job.state==='unknown').length}`;
    if (chooseOther) { chooseOther.hidden=storage.mode !== 'folder' || !rememberedFolder || !!folder;chooseOther.disabled=choose.disabled; }
    panel.querySelector('[data-start]').textContent = running ? '실행 중' : starting ? '시작 준비 중…' : '시작 / 같은 작업 재개';
    decorateIcon(panel.querySelector('[data-start]'),'play_arrow');
    // Keep idle Start clickable so its preflight can explain missing setup.
    panel.querySelector('[data-start]').title = !storage.supported ? storage.message
      : (storage.mode === 'download' && !downloadsReady ? '자동 다운로드 준비 확인을 먼저 완료해 주세요.' : '저장 준비와 대기열을 확인한 뒤 실행합니다.');
  }
  function mount() {
    if (panel || document.getElementById('local-pixai-queue') || !document.body) return;
    panel = node('aside', null, {id:'local-pixai-queue'});
    const style = node('style', `#local-pixai-queue{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:340px;max-height:80vh;overflow:auto;padding:16px;border:1px solid #505862;border-radius:14px;background:#222529;color:#edf1f5;font:14px/1.5 system-ui;box-shadow:0 12px 40px #0006}#local-pixai-queue *{box-sizing:border-box}#local-pixai-queue h2{margin:0 0 8px;font-size:17px}#local-pixai-queue input,#local-pixai-queue textarea{width:100%;margin:5px 0;padding:8px;border:1px solid #4a515a;border-radius:7px;background:#151719;color:inherit;font:inherit}#local-pixai-queue textarea{min-height:85px;resize:vertical}#local-pixai-queue button{margin:4px 4px 4px 0;padding:7px 10px;border:1px solid #616b77;border-radius:7px;background:#30363c;color:inherit;cursor:pointer}#local-pixai-queue button:disabled{opacity:.45;cursor:default}#local-pixai-queue small{display:block;color:#bbc3cc}#local-pixai-queue .pq-job{border-top:1px solid #41474f;padding:8px 0}#local-pixai-queue .pq-job span{display:block;color:#b6c1cc}#local-pixai-queue [data-jobs]{max-height:230px;overflow:auto}#local-pixai-queue [data-message]{white-space:pre-wrap;color:#d9e0e8;margin:8px 0}`);
    const dragHandle = node('h2','PixAI 대기열 · 0.10.3-dev.1', {'data-drag-handle':'',title:'이 제목줄을 드래그해서 이동'});
    style.textContent += '#local-pixai-queue .pq-backup-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}#local-pixai-queue .pq-backup-choices label.pq-check-label,#local-pixai-queue .pq-backup-folder-list label.pq-check-label{margin:5px 0;min-width:0}#local-pixai-queue .pq-backup-choices span,#local-pixai-queue .pq-backup-folder-list span{min-width:0;overflow-wrap:anywhere}#local-pixai-queue .pq-backup-folder-list{max-height:180px;overflow:auto;padding:4px 8px}#local-pixai-queue [data-backup-result]{padding:8px;border-left:3px solid #94bedf;overflow-wrap:anywhere}@media(max-width:700px){#local-pixai-queue .pq-backup-choices{grid-template-columns:minmax(0,1fr)}}';
    style.textContent += '#local-pixai-queue{box-sizing:border-box;width:min(340px,calc(100vw - 16px));pointer-events:auto}#local-pixai-queue button{pointer-events:auto}#local-pixai-queue [data-drag-handle]{margin:0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:grab;user-select:none;touch-action:none}#local-pixai-queue [data-drag-handle][data-dragging]{cursor:grabbing}';
    style.textContent += '#local-pixai-queue :is(button,input,textarea,select,summary):focus-visible{outline:2px solid #acd1ed;outline-offset:2px}#local-pixai-queue button:not(:disabled):hover{border-color:#a9cce7;background:#39434d}#local-pixai-queue [data-primary]{background:#94bedf;color:#16232d;border-color:#94bedf;font-weight:650}#local-pixai-queue [data-primary]:not(:disabled):hover{background:#b3d2eb;color:#16232d}';
    style.textContent += '#local-pixai-queue [data-header]{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;height:32px;margin-bottom:8px;background:#222529}#local-pixai-queue [data-collapse]{width:32px;height:32px;flex:none;margin:0;padding:6px;line-height:0}#local-pixai-queue [data-message]{position:sticky;top:40px;z-index:1;max-height:100px;overflow:auto;padding:7px 9px;border:1px solid #505862;border-radius:7px;background:#222529}#local-pixai-queue [data-action-message]{white-space:pre-wrap;margin:4px 0 10px;padding:7px 9px;border-left:3px solid #94bedf;background:#29343d;color:#edf1f5}';
    style.textContent += '#local-pixai-queue [data-launcher]{display:none;width:52px;height:52px;margin:0;padding:12px;border:1px solid #759bb8;border-radius:50%;line-height:0;background:#30363c;touch-action:none;user-select:none}#local-pixai-queue [data-launcher][data-dragging]{cursor:grabbing}#local-pixai-queue [data-launcher]:focus-visible,#local-pixai-queue [data-collapse]:focus-visible{outline:2px solid #bbdef6;outline-offset:3px}#local-pixai-queue[data-minimized="true"]{width:52px;height:52px;max-height:none;padding:0;border:0;border-radius:50%;overflow:visible}#local-pixai-queue[data-minimized="true"]>:not([data-launcher]){display:none!important}#local-pixai-queue[data-minimized="true"]>[data-launcher]{display:block}';
    function iconControl(label, attribute, path) {
      const control=node('button',null,{type:'button','aria-label':label,title:label,[attribute]:'','aria-controls':'local-pixai-queue'});
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'100%',height:'100%',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
      const drawing=document.createElementNS('http://www.w3.org/2000/svg','path');drawing.setAttribute('d',path);svg.append(drawing);control.append(svg);return control;
    }
    const collapse=iconControl('대기열 접기','data-collapse','M5 12h14');
    const launcher=iconControl('PixAI 대기열 열기','data-launcher','M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M7 16l4-5 3 3 2-2 2 4 M8 8h.01');
    const header=node('div',null,{'data-header':''});header.append(dragHandle,collapse);
    let expandedScrollTop=0,panelDrag=null;
    function minimize(value, remember=true, focus=true) {
      const before=panel.getBoundingClientRect();
      if (value) expandedScrollTop=panel.scrollTop;
      panel.dataset.minimized=String(value);
      panelDrag?.keepRight(before); // not yet bound at startup: the saved position is restored as is
      collapse.setAttribute('aria-expanded',String(!value));launcher.setAttribute('aria-expanded',String(!value));
      if (remember) {try {localStorage.setItem('local.pixai-web-queue.minimized.v1',JSON.stringify(value));} catch { /* Folding does not depend on storage access. */ }}
      if (focus) (value ? launcher : collapse).focus({preventScroll:true});
      if (!value) panel.scrollTop=expandedScrollTop;
    }
    // View-only controls stay enabled during generation and never replace its status.
    bindFolderActivation(collapse,()=>collapse,()=>minimize(true),()=>{});
    let minimized=false;
    try {minimized=JSON.parse(localStorage.getItem('local.pixai-web-queue.minimized.v1')||'false')===true;} catch { /* Ignore malformed or unavailable view preferences. */ }
    minimize(minimized,false,false);
    const toast=node('div',null,{'data-toast':'',role:'status','aria-live':'polite'});toast.hidden=true;
    panel.append(style,launcher,header, node('div',message,{'data-message':'','role':'status','aria-live':'polite'}),toast, node('small','공식 API로 생성·저장 · 이미지 비율·크기는 조합 예약에서, 스타일은 설정에서 정합니다.'));
    panel.append(node('div','저장 폴더 미선택',{'data-folder':''}));
    const choose = button('저장 폴더 선택', chooseFolder);
    choose.dataset.chooseFolder = '';
    choose.dataset.edit = '';
    const chooseOther=button('다른 저장 폴더 선택',()=>chooseFolder({pickNew:true}));
    chooseOther.dataset.chooseOtherFolder='';chooseOther.dataset.edit='';chooseOther.hidden=true;
    panel.append(choose,chooseOther);
    const title = node('input',null,{placeholder:'파일 이름 / 작업 이름', 'data-edit':'', 'aria-label':'대기열 작업 이름'});
    const prompts = node('textarea',null,{placeholder:'프롬프트 입력\n여러 작업은 한 줄 --- 로 구분', 'data-edit':'', 'aria-label':'대기열 프롬프트'});
    const repeat = node('input',null,{type:'number',min:'1',max:'100',value:'1','data-edit':'', 'aria-label':'각 프롬프트 반복 횟수'});
    const simple=node('details');simple.append(node('summary','통짜 프롬프트 · 간단 대기열'),title,prompts,node('small','반복 횟수 (생성 버튼을 누르는 횟수)'),repeat);
    const budget = node('input',null,{type:'number',min:'1',value:'7800','data-edit':'','aria-label':'생성 1회 크레딧 상한'});
    const budgetLabel=node('small','생성 1회 크레딧 상한 (빈칸은 제한 없음)');panel.append(budgetLabel,budget);
    const imageCountLabel=node('label','생성당 이미지 수');
    const imageCount=node('select',null,{'data-edit':'','data-image-count':'','aria-label':'기본 생성당 이미지 수'});
    for (const [value,name] of [[4,'4장 배치'],[1,'1장'],[0,'사이트 선택 유지']]) imageCount.append(node('option',name,{value:String(value)}));
    imageCount.value='4';imageCountLabel.append(imageCount);imageCountLabel.hidden=true;
    const inFlightLabel=node('label','미리 등록할 작업 수 (1~10)');
    const maxInFlight=node('input',null,{type:'number',min:'1',max:'10',value:'3','data-edit':'','data-max-in-flight':'','aria-label':'미리 등록할 작업 수'});
    inFlightLabel.append(maxInFlight);
    budget.hidden=true;budgetLabel.hidden=true; // Retain old backup values, without promising API budget enforcement.
    const apiContent=node('div',null,{class:'pq-api-settings'});
    const keyInput=node('input',null,{type:'password',autocomplete:'off',placeholder:'공식 API 키 · 기본값은 저장 안 함','aria-label':'공식 API 키','data-edit':''});
    const keyState=node('small',null,{'data-api-key-state':'',role:'status'});
    // One-line summary stays visible; the long explanation opens on demand so the settings page reads lighter.
    function note(summary,...lines) {const box=node('details',null,{class:'pq-note'});box.append(node('summary',summary),...lines.map(text=>node('small',text)));return box;}
    const rememberInput=node('input',null,{type:'checkbox','data-remember-api-key':'','aria-label':'이 브라우저에 API 키 기억하기 (선택)'});rememberInput.checked=rememberedKey.status()==='saved';rememberInput.disabled=!rememberedKey.supported;
    const rememberLabel=node('label',null,{class:'pq-check-label'});rememberLabel.append(rememberInput,node('span','이 브라우저에 API 키 기억하기 (선택)'));
    rememberInput.addEventListener('change',event=>{
      if(event.isTrusted===false){rememberInput.checked=rememberedKey.status()==='saved';return;}
      try {
        if(running || starting || settingsBusy)throw new Error('실행이 끝난 뒤 키 저장 설정을 바꿔 주세요.');
        if(!rememberInput.checked){rememberedKey.forget();message='저장된 키를 삭제했습니다. 현재 탭의 연결은 유지하며 다른 탭의 연결은 각 탭에서 지워 주세요.';}
        else message='키 연결 버튼을 누르면 스크립트 관리자에 저장합니다. 체크만으로 저장하지 않습니다.';
      } catch(error) {rememberInput.checked=rememberedKey.status()==='saved';message=error.message;}render();
    });
    const connectKey=button('이 탭에 키 연결',()=>{try {rememberedKey.connect(keyInput.value || (apiKey.has()?apiKey.get():''),rememberInput.checked);message=`키 입력 완료. ${rememberedKey.status()==='saved' ? '다음 방문에 저장된 키를 불러옵니다.' : '이 탭에서만 보관합니다.'} 연결 확인은 기존 작업 조회로 할 수 있습니다. 새 생성은 아직 실행하지 않았습니다.`;} finally {keyInput.value='';render();}});connectKey.dataset.edit='';
    const clearKey=button('키 지우기',()=>{try {rememberedKey.clear();rememberInput.checked=false;message='이 탭과 스크립트 관리자에 저장된 API 키를 지웠습니다. 다른 탭의 연결은 각 탭에서 지워 주세요.';} finally {keyInput.value='';render();}});clearKey.dataset.edit='';
    const verifyId=node('input',null,{'aria-label':'연결 확인용 기존 작업 ID',placeholder:'기존 작업 ID (조회만 함)','data-edit':''});
    const verifyKey=button('기존 작업으로 연결 확인',()=>settingsAction(async()=>{
      const id=verifyId.value.trim() || jobs.find(job=>job.taskId)?.taskId;
      const task=await api.task(presetIdentifier(id,'기존 작업',true));
      if (String(task.id)!==String(id) || !['waiting','running','completed','failed','cancelled'].includes(task.status)) throw new Error('조회 응답의 작업 ID·상태를 확인하지 못했습니다.');
      message=`공식 API 인증·조회 성공 · 작업 ${id} · ${task.status}. 새 생성·다운로드는 실행하지 않았습니다.`;render();
    },{readOnly:true}));verifyKey.dataset.edit='';
    const apiFields={};
    function apiField(key,label,values) {
      const wrapper=node('label',label),control=values ? node('select',null,{'data-edit':'','aria-label':label}) : node('input',null,{'data-edit':'','aria-label':label});
      if (values) for (const [value,name] of values) control.append(node('option',name,{value}));
      apiFields[key]=control;wrapper.append(control);apiContent.append(wrapper);return control;
    }
    apiContent.append(keyInput,rememberLabel,connectKey,clearKey,keyState,note('공용 PC에서는 키를 기억하지 마세요 · 자세히','기본값은 저장 안 함입니다. 기억하기는 Tampermonkey의 이 스크립트 저장소를 사용합니다. 키는 이 도구의 설정·대기열 백업에서 제외됩니다.','암호화 금고는 아닙니다. 입력칸은 PixAI 페이지 안에 있으며, 확장 관리자 백업·동기화에는 키가 포함될 수 있습니다.'),verifyId,verifyKey);
    apiField('modelVersionId','통짜 대기열 기본 모델 버전 ID (프리셋 지정 시 해당 프리셋 우선)');
    const applyImageOptions=button('미제출 대기 작업에 비율·크기 적용',async()=>{
      if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 요청을 바꿀 수 없습니다.');
      const options=currentApiOptions();let count=0;
      await locked(()=>{
        const before=jobs,next=applyQueuedImageOptions(jobs,options);count=next.filter((job,index)=>job!==before[index]).length;
        jobs=next;try {persist();} catch(error) {jobs=before;throw error;}
      });
      message=`미제출 대기 작업 ${count}건에 ${options.aspectRatio} (가로:세로) · ${options.size} 적용 완료. 새 생성은 하지 않았습니다.`;render();
    });applyImageOptions.dataset.edit='';applyImageOptions.dataset.siteIo='';
    const imageActions=node('details');imageActions.append(node('summary','기존 대기 작업의 비율·크기 변경'),note('이미 등록한 작업은 기존 비율·크기를 유지합니다.','아래 버튼은 미제출 작업에만 현재 선택값을 적용합니다. 예약별로 다른 비율을 유지하려면 적용 대상을 확인하세요.'),applyImageOptions);
    apiField('style','츠바키 API 스타일',[['','스타일 보내지 않음'],...API_STYLES.map(value=>[value,value])]);
    apiField('seed','API 시드 (빈칸은 작업별 랜덤)').setAttribute('placeholder','0~4294967295');
    const embedMetadata=node('input',null,{type:'checkbox','data-edit':'','aria-label':'PNG에 생성 요청 정보 기록 (선택)'});embedMetadata.checked=false;const embedMetadataLabel=node('label',null,{class:'pq-check-label'});embedMetadataLabel.append(embedMetadata,node('span','PNG에 생성 요청 정보 기록 · 공유 시 포지/네거·모델/LoRA·요청 시드도 전달됩니다. 기본 꺼짐, JPEG/WebP는 원본 그대로, JSON 파일은 추가하지 않습니다.'));apiContent.append(embedMetadataLabel);embedMetadata.addEventListener('change',async()=>{const previous=savedOptions.embedMetadata===true;try{if(running||starting||settingsBusy)throw Error('실행 중에는 PNG 기록 선택을 바꿀 수 없습니다.');await settingsAction(()=>{const options=normalizeSettingsOptions({...savedOptions,embedMetadata:embedMetadata.checked});localStorage.setItem(OPTIONS_KEY,JSON.stringify(options));savedOptions=options;});message='PNG 기록 선택을 저장했습니다. 새로 등록하는 작업부터 적용합니다.';}catch(error){embedMetadata.checked=previous;message=error.message;}render();});
    const costAck=node('input',null,{type:'checkbox','data-api-cost-ack':'','data-edit':''});
    costAck.checked=false;
    try {costAck.checked=JSON.parse(localStorage.getItem(API_COST_ACK_KEY) || 'false')===true;} catch {message='과금 안내 체크를 읽지 못했습니다. 내용을 확인하고 다시 체크해 주세요.';}
    let savedCostAck=costAck.checked;
    costAck.addEventListener('change',()=>{
      try {localStorage.setItem(API_COST_ACK_KEY,JSON.stringify(costAck.checked));savedCostAck=costAck.checked;}
      catch(error) {costAck.checked=savedCostAck;message=`과금 안내 체크 저장 실패: ${error.message}`;render();}
    });
    const costAckLabel=node('label',null,{class:'pq-check-label'});costAckLabel.append(costAck,node('span','시작은 크레딧을 사용하는 공식 API 생성 요청이며, 기존 사이트 비용 상한을 이 API 실행에 적용할 수 없음을 확인했습니다.'));
    apiContent.append(note('비율·크기·생성 모드·배치 수는 조합 예약에서 고릅니다 · 자세히','모델·LoRA는 프리셋에서, 스타일·시드는 여기서 정합니다. 사이트의 해상도·스타일·참조 설정은 자동 복사하지 않습니다. LoRA 수치는 0~1, 최대 5개입니다.'),costAckLabel);
    function readApiFields() {return normalizeApiOptions({...apiOptions,...Object.fromEntries(Object.entries(apiFields).map(([key,input])=>[key,input.value]))});}
    function readOptions() {
      return normalizeSettingsOptions({maxCredits:budget.value.trim() ? Number(budget.value) : null,filePrefix:title.value,repeat:Number(repeat.value),imageCount:Number(imageCount.value),maxInFlight:Number(maxInFlight.value),api:readApiFields(),...(Object.hasOwn(savedOptions,'embedMetadata')?{embedMetadata:embedMetadata.checked}:{})});
    }
    let savedOptions=normalizeSettingsOptions({maxCredits:7800,filePrefix:'',repeat:1});
    function fillOptions(value) {
      savedOptions=normalizeSettingsOptions(value);embedMetadata.checked=savedOptions.embedMetadata===true;
      budget.value=value.maxCredits == null ? '' : String(value.maxCredits);
      title.value=value.filePrefix;repeat.value=String(value.repeat);
      imageCount.value=String(value.imageCount ?? 4);maxInFlight.value=String(value.maxInFlight ?? 3);
      apiOptions=normalizeApiOptions(value.api);for (const [key,input] of Object.entries(apiFields)) input.value=String(apiOptions[key]);
    }
    function loadOptions() {
      fillOptions(normalizeSettingsOptions(JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{"maxCredits":7800,"filePrefix":"","repeat":1}')));
    }
    try {loadOptions();} catch {fillOptions(savedOptions);message='기본 옵션을 읽지 못해 기본값으로 열었습니다. 기억한 조합 편집 상태가 있으면 비율·크기는 그 값으로 복원합니다. 조합 예약 상단에서 확인해 주세요.';}
    for (const input of [budget,title,repeat,imageCount,maxInFlight,...Object.values(apiFields)]) input.addEventListener('change',()=>{
      try {const options=readOptions();localStorage.setItem(OPTIONS_KEY,JSON.stringify(options));fillOptions(options);render();}
      catch(error) {fillOptions(savedOptions);message=`기본 옵션 저장 실패: ${error.message}\n화면과 실행 옵션을 이전 설정으로 되돌렸습니다.`;render();}
    });
    const add = button('대기열 추가', async () => locked(() => {
      const parts = prompts.value.split(/\n\s*---+\s*\n/).map(normalize).filter(Boolean);
      const count = Number(repeat.value);
      const maxCredits = budget.value.trim() ? Number(budget.value) : null;
      if (!parts.length || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('프롬프트와 1~100회 반복 횟수를 입력해 주세요.');
      if (maxCredits != null && (!Number.isSafeInteger(maxCredits) || maxCredits < 1)) throw new Error('크레딧 상한은 양의 정수로 입력해 주세요.');
      if (jobs.length + parts.length * count > 1000) throw new Error('대기열은 최대 1,000개까지 추가할 수 있습니다.');
      const added = [];
      for (let index=0; index<parts.length; index++) for (let n=0; n<count; n++) added.push({
        id:crypto.randomUUID(), title:`${title.value.trim() || 'PixAI'}_${index+1}_${n+1}`, prompt:parts[index], maxCredits, state:'queued', saved:[],apiOptions:currentApiOptions(),apiBatchSize:currentApiBatchSize(),embedMetadata:savedOptions.embedMetadata===true
      });
      jobs.push(...added); persist(); prompts.value=''; message=`${added.length}개 작업을 추가했습니다.`; render();
    }));
    add.dataset.edit='';
    const run = button('시작 / 같은 작업 재개', start); run.dataset.start=''; run.dataset.primary='';run.dataset.headerFeedback='';
    const testRun=button('첫 작업만 실행',()=>start({oneJob:true}));testRun.dataset.edit='';testRun.dataset.headerFeedback='';testRun.title='첫 미완료 작업 1회만 생성·저장합니다. 나머지 작업은 유지합니다.';decorateIcon(testRun,'play_arrow');
    simple.append(add);
    const editorSlot=node('div',null,{class:'pq-workspace'});panel.append(editorSlot);
    let attachRuntimePages=()=>{};
    function mountEditor() { try { presetEditor=mountPresetEditor(editorSlot, {
      isBusy:() => starting || settingsBusy,isRunning:()=>running||starting||settingsBusy, // library/compose editing stays open while this tab runs the queue; render() locks runtime pages
      load:readLibrary,save:saveLibrary,button,
      loadGroupView:name=>readGroupView(localStorage,LIBRARY_KEY+'.view.'+name),saveGroupView:(name,value)=>localStorage.setItem(LIBRARY_KEY+'.view.'+name,JSON.stringify(value)),loadStudioDraft:()=>JSON.parse(localStorage.getItem(LIBRARY_KEY+'.studio-draft')||'null'),saveStudioDraft:value=>localStorage.setItem(LIBRARY_KEY+'.studio-draft',JSON.stringify(value)),getThumbnail:id=>sceneThumbnails.get(id),
      applyImageComposition:(result,expected)=>settingsAction(()=>{if(expected&&JSON.stringify(readLibrary())!==JSON.stringify(normalizePresetLibrary(expected)))throw Error('이미지 적용 전에 다른 탭에서 재료가 바뀌었습니다. 다시 적용해 주세요.');const options=normalizeSettingsOptions({...savedOptions,api:{...apiOptions,...result.api}});atomicRecordWrite(localStorage,{[LIBRARY_KEY]:JSON.stringify(result.library),[OPTIONS_KEY]:JSON.stringify(options),[COMPOSE_DRAFT_KEY]:JSON.stringify(normalizeComposeDraft(result.recipe))},LIBRARY_KEY+'.before-image-import');fillOptions(options);}),

      isCompact:()=>(panel.getBoundingClientRect().width || document.documentElement?.clientWidth || window.innerWidth)<=760,
      loadLayout:key=>JSON.parse(localStorage.getItem(`local.pixai-web-queue.layout.v1.${key}`) || 'null'),
      saveLayout:(key,value)=>localStorage.setItem(`local.pixai-web-queue.layout.v1.${key}`,JSON.stringify(value)),
      notify:notifyAction,getImageOptions:()=>apiOptions,getBatchSize:()=>Number(imageCount.value) || 1,
      saveImageOptions:value=>{
        const {batchSize,...images}=normalizeReservationImageOptions(value);
        const options=normalizeSettingsOptions({...savedOptions,imageCount:batchSize ?? savedOptions.imageCount,api:{...apiOptions,...images}});
        localStorage.setItem(OPTIONS_KEY,JSON.stringify(options));savedOptions=options;apiOptions=normalizeApiOptions(options.api);
        imageCount.value=String(options.imageCount);
      },imageOptionsChanged:render,
      loadDraft:()=>JSON.parse(localStorage.getItem(COMPOSE_DRAFT_KEY) || 'null'),
      saveDraft:draft=>localStorage.setItem(COMPOSE_DRAFT_KEY,JSON.stringify(normalizeComposeDraft(draft))),
      loadComposeGroups:()=>JSON.parse(localStorage.getItem(COMPOSE_DRAFT_KEY+'.groups.v1')||'null'),
      saveComposeGroups:value=>localStorage.setItem(COMPOSE_DRAFT_KEY+'.groups.v1',JSON.stringify(value)),
      captureSettings:()=>settingsAction(()=>capturePresetSettings(settings,readLoraTriggerWords),{readOnly:true}),
      applySettings:value=>settingsAction(()=>settings.apply(value)),
      enqueue:(value,{fresh=false}={})=>queueEdit(()=>withLibraryLock(()=>{
        const added=expandPresetReservations(value,{maxCredits:budget.value.trim()||null,titlePrefix:title.value.trim()});
        for (const job of added) {job.apiOptions=normalizeApiOptions({...currentApiOptions(),...job.apiOptions});job.apiBatchSize=job.apiBatchSize || currentApiBatchSize();}
        if (jobs.length+added.length>1000) throw new Error('대기열은 최대 1,000개까지 추가할 수 있습니다.');
        if (value.reservations.some(res=>jobs.some(job=>job.composition?.reservation?.id===res.id))) throw new Error('이미 등록된 예약이 있습니다. 해당 예약을 제외하고 새로 예약해 주세요.');
        const nextLibrary=subsetRegisteredLibrary(readLibrary(),normalizePresetLibrary(value),{fresh});
        for(const job of added)job.embedMetadata=savedOptions.embedMetadata===true;
        atomicRecordWrite(localStorage,{[KEY]:JSON.stringify({version:1,jobs:[...jobs,...added]}),[LIBRARY_KEY]:JSON.stringify(nextLibrary)},LIBRARY_KEY+'.before-registration');jobs.push(...added);let refreshWarning='';try{presetEditor.refresh();}catch{refreshWarning=' 화면 갱신을 다시 시도해 주세요.';}
        message=`조합 ${added.length}개를 대기열에 등록했습니다. 다른 미등록 예약과 작업별 설정은 유지합니다.${refreshWarning}${running ? (stopRequested ? ' 중지 요청 중이므로 다음 시작 때 실행합니다.' : oneJobRun ? ' 첫 작업만 실행 중이므로 이번에는 실행하지 않고 다음 시작 때 실행합니다.' : ' 실행 중인 작업이 끝나면 순서대로 이어서 실행합니다.') : ''}`;render();
      }))
    }); attachRuntimePages(); } catch(error) { message=`프리셋 라이브러리 읽기 실패: ${error.message}`; } }
    mountEditor();
    const stopButton=button('중지',()=>{stopRequested=true;message='다음 제출 중지 요청. 진행 중인 서버 작업은 취소하지 않습니다.';render();});
    stopButton.dataset.headerFeedback='';
    panel.append(simple,run,stopButton);
    panel.append(node('div',null,{'data-jobs':''}));
    const exportQueue = button('대기열 백업', async () => {
      const blob = new Blob([JSON.stringify({version:1,jobs,library:readLibrary()},null,2)],{type:'application/json'});
      if (storage.mode === 'download') { await writeNew('pixai-queue-backup.json',blob);message='대기열 백업 다운로드 완료';render();return; }
      const url = URL.createObjectURL(blob); const anchor=node('a',null,{href:url,download:'pixai-queue-backup.json'});
      anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
    });
    panel.append(exportQueue);
    const backups=node('details');backups.append(node('summary','설정 내보내기 · 불러오기'));
    backups.append(node('small','공통문·프리셋·캐릭터·청크·폴더·목록 순서·예약 사본·최근 조합·즐겨찾기와 실행 옵션을 JSON으로 보관합니다. 편집한 항목은 먼저 저장해 주세요.'));
    const settingsStore=createSettingsStore(localStorage,{library:LIBRARY_KEY,options:OPTIONS_KEY,previous:PREVIOUS_SETTINGS_KEY});
    function idleSettings() {
      if (running || starting || settingsBusy || choosingFolder) throw new Error('진행 중인 작업이 끝난 뒤 설정을 불러오거나 내보내 주세요.');
    }
    function backupButton(label,run) {const control=button(label,()=>{idleSettings();return run();});control.dataset.edit='';return control;}
    async function downloadSettings(data,suffix='설정'){
      const text=JSON.stringify(data,null,2);parseSettingsBackup(text);
      const name=`PixAI_${suffix}_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      const blob=new Blob([text],{type:'application/json'});
      if (download) {await managedDownload(download,blob,name);message='설정 JSON 다운로드 완료';}
      else {
        const url=URL.createObjectURL(blob),anchor=node('a',null,{href:url,download:name});
        document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
        message='설정 JSON 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.';
      }
      render();
    }
    const saveSettings=backupButton('설정 내보내기',()=>downloadSettings(makeSettingsBackup(readLibrary(),readOptions(),{appVersion:'0.10.3-dev.1',exportedAt:new Date().toISOString()})));
    const compatibility=node('div',null,{'data-compatibility-preview':'',role:'status'});compatibility.hidden=true;
    function compatibilityButton(label,target){return backupButton(label,()=>{const result=compatibleSettings(readLibrary(),readOptions(),{appVersion:'0.10.3-dev.1',exportedAt:new Date().toISOString()},target);compatibility.replaceChildren(node('strong',label),node('p',result.warnings.length?result.warnings.join('\n'):'재료·공통문 연결·씬·출연·구성·예약 사본을 유지합니다. 실행 작업과 브라우저 화면 위치는 포함하지 않습니다.'),backupButton('변환 내용 확인 후 파일 저장',async()=>{await downloadSettings(result.backup,target==='app'?'앱_호환':'스크립트_0.9.14_호환');compatibility.hidden=true;}),button('내보내기 취소',()=>{compatibility.hidden=true;}));compatibility.hidden=false;});}
    const input=node('input',null,{type:'file',accept:'.json,application/json','aria-label':'설정 백업 JSON 파일','data-edit':''});input.hidden=true;
    const preview=node('div',null,{'data-import-preview':'','aria-live':'polite'});preview.hidden=true;
    let pendingSettings=null;
    function clearImport() {pendingSettings=null;preview.replaceChildren();preview.hidden=true;}
    const openSettings=backupButton('설정 불러오기',()=>{clearImport();input.value='';input.click();});
    async function editSettings(action) {
      await settingsAction(async()=>{
        if (!navigator.locks) throw new Error('이 브라우저는 중복 실행 방지 기능을 지원하지 않습니다.');
        await navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
          if (!lock) throw new Error('다른 PixAI 탭에서 대기열이 실행 중입니다.');
          if (stopRequested) throw new Error('설정 불러오기가 중지됐습니다.');
          await withLibraryLock(action);
          loadOptions();
          if (presetEditor) presetEditor.reload();else mountEditor();
        });
      },{readOnly:true});
      clearImport();
    }
    function preparedImport() {
      if (!pendingSettings) throw new Error('설정 파일을 먼저 선택해 주세요.');
      const p=pendingSettings,result=prepareBackupImport(readLibrary(),p.transfer,p.selection,p.mode,undefined,p.folders);
      // An app backup has no browser PNG-recording preference. Keep this local option.
      if(result.options && !Object.hasOwn(result.options,'embedMetadata') && Object.hasOwn(savedOptions,'embedMetadata')) result.options={...result.options,embedMetadata:savedOptions.embedMetadata};
      return result;
    }
    const applyImport=backupButton('선택한 항목 가져오기',async()=>{
      if (!pendingSettings) throw new Error('설정 파일을 먼저 선택해 주세요.');
      await editSettings(()=>{
        if (localStorage.getItem(LIBRARY_KEY)!==pendingSettings.libraryBefore || localStorage.getItem(OPTIONS_KEY)!==pendingSettings.optionsBefore) throw new Error('파일을 선택한 뒤 설정이 바뀌었습니다. 파일을 다시 선택해 주세요.');
        const result=preparedImport();
        settingsStore.apply({library:result.library,options:result.options ?? null});
      });
      message='설정을 불러왔습니다. 가져오기 전 설정 복구로 되돌릴 수 있습니다. 이미 등록한 대기열은 유지됩니다.';render();
    });
    function drawImport() {
      const p=pendingSettings;if(!p)return;
      const focused=document.activeElement?.getAttribute?.('aria-label');
      const library=p.transfer.backup.library;
      const mode=node('select',null,{'aria-label':'백업 가져오기 방식','data-edit':'','data-backup-mode':''});
      mode.append(node('option','기존 자료에 추가',{value:'append'}),node('option','선택한 종류·폴더만 교체',{value:'replace'}));mode.value=p.mode;
      mode.addEventListener('change',()=>{idleSettings();p.mode=mode.value;drawImport();});
      const choices=node('div',null,{class:'pq-backup-choices'});
      for(const key of [...BACKUP_CATEGORIES,'common','options']) {
        const label=node('label',null,{class:'pq-check-label'}),check=node('input',null,{type:'checkbox','aria-label':`백업 가져오기: ${BACKUP_LABELS[key]}`,'data-edit':''});
        check.checked=!!p.selection[key];check.disabled=!p.transfer.selection[key]||(key==='options'&&!p.data.options);check.dataset.unavailable=String(check.disabled);
        check.addEventListener('change',()=>{idleSettings();p.selection[key]=check.checked;drawImport();});
        label.append(check,node('span',`${BACKUP_LABELS[key]}${Array.isArray(library[key])?` · ${library[key].length}개`:''}`));choices.append(label);
      }
      const scopes=[];
      for(const key of ['scenes','sceneCards']) {
        if(!p.selection[key])continue;
        const limit=p.transfer.folderSelection?.[key],all=backupFolderChoices(library,key).filter(folder=>!limit||limit.includes(folder.id));
        const group=node('details',null,{class:'pq-backup-folders'}),chosen=p.folders[key]||all.map(folder=>folder.id);
        group.open=!!p.openFolders[key];group.addEventListener('toggle',()=>{p.openFolders[key]=group.open;});
        group.append(node('summary',`${BACKUP_LABELS[key]} 폴더 · ${chosen.length}/${all.length} 선택`));
        const list=node('div',null,{class:'pq-backup-folder-list'});
        for(const folder of all) {
          const label=node('label',null,{class:'pq-check-label'}),check=node('input',null,{type:'checkbox','aria-label':`백업 폴더: ${BACKUP_LABELS[key]}: ${folder.name}`,'data-edit':''});check.checked=chosen.includes(folder.id);
          check.addEventListener('change',()=>{idleSettings();p.folders[key]=all.filter(item=>item.id===folder.id?check.checked:chosen.includes(item.id)).map(item=>item.id);drawImport();});
          label.append(check,node('span',`${folder.name} · ${folder.count}개`));list.append(label);
        }
        group.append(list);scopes.push(group);
      }
      const summary=node('div',null,{'data-backup-result':'',role:'status'});
      try {
        let n=0;const result=prepareBackupImport(readLibrary(),p.transfer,p.selection,p.mode,()=>`import-preview-${++n}`,p.folders),before=readLibrary();
        summary.append(node('p',BACKUP_CATEGORIES.filter(key=>p.selection[key]||result.dependencies[key]).map(key=>`${BACKUP_LABELS[key]} ${before[key]?.length||0} → ${result.library[key]?.length||0}개`).join(' · ')||'기본 공통문·설정만 선택'),node('p',`적용 범위: ${backupSelectionLabels(library,p.selection,p.folders).join(' · ')}`));
        const deps=Object.entries(result.dependencies).map(([key,count])=>`${BACKUP_LABELS[key]} ${count}개`);if(deps.length)summary.append(node('p',`필요한 연결 자료 추가: ${deps.join(' · ')}`));
        if(p.mode==='replace') {
          const empty=BACKUP_CATEGORIES.filter(key=>p.selection[key]&&!(library[key]?.length));
          if(empty.length)summary.append(node('p',`빈 목록 교체: ${empty.map(key=>BACKUP_LABELS[key]).join(' · ')}. 선택 범위의 기존 항목을 비웁니다.`));
          for(const key of ['scenes','sceneCards'])if(p.selection[key]&&p.folders[key]?.some(id=>backupFolderChoices(library,key).find(folder=>folder.id===id)?.count===0))summary.append(node('p',`빈 ${BACKUP_LABELS[key]} 폴더를 포함합니다. 같은 ID의 선택 폴더 안 기존 항목은 비워집니다.`));
        }
        for(const warning of result.warnings)summary.append(node('p',warning));
        applyImport.dataset.unavailable='false';applyImport.disabled=false;
      } catch(error) {summary.append(node('p',error.message));applyImport.dataset.unavailable='true';applyImport.disabled=true;}
      preview.replaceChildren(node('strong',p.name),node('p','추가는 같은 이름도 새 항목으로 보관합니다. 교체는 선택 범위만 바꾸며, 폴더는 이름이 아니라 ID로 구분합니다.'),mode,choices,...scopes,summary,node('p',(p.data.conversionWarnings||[]).join('\n')),node('small','생성·화면 설정은 기본 제외입니다. API 키·저장 위치·등록된 대기 작업·이 브라우저의 화면 배치는 가져오지 않습니다. 적용 전 설정은 복구용으로 보관합니다.'),applyImport,backupButton('불러오기 취소',()=>{clearImport();message='설정 불러오기를 취소했습니다.';render();}));
      preview.hidden=false;
      if(focused)Array.from(preview.querySelectorAll('[aria-label]')).find(control=>control.getAttribute('aria-label')===focused)?.focus();
    }
    input.addEventListener('change',async()=>{
      clearImport();
      const file=input.files?.[0];if (!file) return;
      try {
        idleSettings();
        await settingsAction(async()=>{
          if (file.size>5*1024*1024) throw new Error('설정 파일은 5MiB까지 불러올 수 있습니다.');
          const libraryBefore=localStorage.getItem(LIBRARY_KEY),optionsBefore=localStorage.getItem(OPTIONS_KEY);
          const data=parseSettingsBackup(await file.text());
          if (stopRequested) throw new Error('설정 파일 읽기가 중지됐습니다.');
          const transfer=data.transfer||{format:'pixai-clack-helper-selection',version:1,selection:{...backupSelection(),options:!!data.options},backup:data};
          pendingSettings={data,name:file.name,transfer,selection:{...transfer.selection,options:false},folders:{...transfer.folderSelection},openFolders:{},mode:'append',libraryBefore,optionsBefore};
          drawImport();message='파일 확인 완료. 범위와 적용 결과를 확인한 뒤 선택한 항목 가져오기를 누르세요.';
        },{readOnly:true});
      } catch(error) {clearImport();message=`설정 파일 읽기 실패: ${error.message}`;render();}
    });
    const undoSettings=backupButton('가져오기 전 설정 복구',async()=>{
      await editSettings(()=>{
        const previous=JSON.parse(localStorage.getItem(PREVIOUS_SETTINGS_KEY) || 'null');
        try {
          if (previous?.library != null) normalizePresetLibrary(JSON.parse(previous.library));
          if (previous?.options != null) normalizeSettingsOptions(JSON.parse(previous.options));
        } catch {throw new Error('이전 설정 원본에 읽기 오류가 있어 복구하지 않았습니다. 원본 사본과 현재 설정은 유지했습니다.');}
        settingsStore.undo();
      });message='가져오기 전 설정으로 복구했습니다.';render();
    });
    backups.append(saveSettings,compatibilityButton('앱 호환 내보내기','app'),compatibilityButton('0.9.14 호환 내보내기','legacy'),compatibility,openSettings,input,preview,undoSettings);panel.append(backups);
    const footer=node('div',null,{class:'pq-footer'});
    decorateIcon(run,'play_arrow');decorateIcon(stopButton,'stop');
    // Both run buttons sit together in the footer; the Settings tab is the only way to the settings page.
    footer.append(node('span',null,{'data-queue-counts':'',role:'status'}),testRun,run,stopButton);
    const folderStatus=panel.querySelector('[data-folder]'),jobsView=panel.querySelector('[data-jobs]');
    const intro=[...panel.children].find(child=>child.tagName.toLowerCase()==='small');
    const settingsContent=node('div',null,{class:'pq-settings-content'});
    // Two columns on a wide panel: API connection/generation options on the left, storage/run/backup on the right.
    const settingsMain=node('div',null,{class:'pq-settings-column'}),settingsSide=node('div',null,{class:'pq-settings-column'});
    const installedChannel=updateChannelInfo(typeof GM_info==='object' ? GM_info : null),channelNames={stable:'안정판',development:'개발판'};
    let selectedChannel=installedChannel.installed;
    const updateControls=node('div',null,{class:'pq-update-channel'}),updateStatus=node('p',`현재 설치: ${channelNames[installedChannel.installed]} · ${installedChannel.version}`,{'data-update-status':'',role:'status'}),channelChoices=node('div',null,{class:'pq-actions',role:'group','aria-label':'업데이트 채널 선택'}),channelHint=node('p',null,{'data-update-hint':''}),installChannel=node('a','선택한 채널 설치 화면 열기',{'data-update-install':'',target:'_blank',rel:'noopener noreferrer'}),updateFeedback=node('p',null,{'data-update-feedback':'',role:'status'});
    const channelButtons={};
    function renderUpdateChoice(){for(const [id,control] of Object.entries(channelButtons))control.setAttribute('aria-pressed',String(selectedChannel===id));installChannel.setAttribute('data-update-channel',selectedChannel);installChannel.setAttribute('href',updateChannelUrl(selectedChannel));installChannel.setAttribute('aria-label',`${channelNames[selectedChannel]} 설치·업데이트 화면 열기`);channelHint.textContent=selectedChannel==='development'?'개발 중인 변경을 먼저 사용합니다. 오류나 변경이 있을 수 있습니다.':'검증 후 정식 배포한 버전을 사용합니다.';updateFeedback.textContent='';}
    for(const id of Object.keys(channelNames)){const control=button(channelNames[id],()=>{if(running||starting||settingsBusy||choosingFolder)throw new Error('실행·저장 준비가 끝난 뒤 업데이트 채널을 골라 주세요.');selectedChannel=id;renderUpdateChoice();});control.setAttribute('data-edit','');control.setAttribute('data-update-choice','');control.setAttribute('data-view-only','');control.setAttribute('aria-label',`업데이트 채널: ${channelNames[id]}`);channelButtons[id]=control;channelChoices.append(control);}
    installChannel.addEventListener('click',event=>{if(event.isTrusted===false||running||starting||settingsBusy||choosingFolder){event.preventDefault();if(event.isTrusted!==false){message='실행·저장 준비가 끝난 뒤 설치 화면을 열어 주세요.';render();}return;}updateFeedback.textContent='설치 화면에서 업데이트·재설치를 확인한 뒤 PixAI를 새로고침해 주세요. 취소하면 현재 채널을 유지합니다.';});
    const automaticText=installedChannel.enabled===false?'자동 업데이트 꺼짐 · Tampermonkey에서 확인해 주세요.':installedChannel.automatic?`자동 업데이트 주소: ${channelNames[installedChannel.automatic]}`:'자동 업데이트 주소 확인 불가 · Tampermonkey에서 확인해 주세요.';
    updateControls.append(updateStatus,node('small',automaticText),channelChoices,channelHint,installChannel,updateFeedback,note('채널 전환 방법 · 자세히','설정에서 채널을 골라 설치 화면을 여세요. Tampermonkey에서 기존 항목의 업데이트·재설치를 확인해야 실제 채널과 자동 업데이트 주소가 바뀝니다. 개발판보다 이전 버전의 안정판으로 돌아갈 때는 구버전 설치 확인이 나올 수 있습니다. 삭제 후 재설치하지 마세요. 전환 전 설정 백업을 권장합니다.'));
    renderUpdateChoice();
    settingsMain.append(node('h3','공식 API 연결·생성 옵션'),apiContent);
    settingsSide.append(node('h3','저장 위치'),folderStatus,choose,chooseOther,node('h3','실행 옵션'),budgetLabel,budget,imageCountLabel,inFlightLabel,note('작업을 순서대로 미리 등록하고, 저장이 끝나면 다음 작업을 채웁니다 · 자세히','첫 작업만 실행은 1건만 처리합니다. 미리 등록할 작업 수만큼 생성 요청이 먼저 나갑니다.'),node('h3','업데이트 채널'),updateControls,node('h3','설정 백업'),backups);
    panel.append(node('style','#local-pixai-queue .pq-update-channel p{margin:8px 0;line-height:1.5}#local-pixai-queue .pq-update-channel .pq-actions{margin-top:10px}#local-pixai-queue .pq-update-channel [data-update-choice][aria-pressed="true"]{border-color:var(--pq-accent,#78cdb8);background:var(--pq-accent-soft,#2c3e40)}#local-pixai-queue .pq-update-channel a[data-update-install]{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:100%;padding:8px 12px;border:1px solid var(--pq-accent,#78cdb8);border-radius:6px;background:var(--pq-accent-soft,#2c3e40);color:var(--pq-text,#edf1f4);text-decoration:none;line-height:1.5}#local-pixai-queue .pq-update-channel a[data-update-install]:focus-visible{outline:2px solid var(--pq-accent,#78cdb8);outline-offset:2px}#local-pixai-queue .pq-update-channel a[aria-disabled="true"]{opacity:.45}#local-pixai-queue .pq-update-channel [data-update-feedback]:empty{display:none}'));
    settingsContent.append(settingsMain,settingsSide);
    backups.open=true;
    const queueContent=node('div',null,{class:'pq-queue-content'});queueContent.append(node('h3','등록된 대기열'),jobsView,simple,exportQueue);
    attachRuntimePages=()=>{
      presetEditor.addPage('queue','대기열',queueContent);presetEditor.addPage('settings','설정',settingsContent);presetEditor.addImageActions(imageActions);
      editorSlot.replaceChildren(presetEditor.root);
    };
    if (presetEditor) attachRuntimePages();else editorSlot.append(settingsContent,queueContent);
    const resizeHandle=node('div',null,{class:'pq-window-resize',role:'button',tabindex:'0','aria-label':'작업창 크기 조절',title:'드래그해 작업창 크기 조절 · 방향키로 조절'});resizeHandle.append(materialIcon('open_in_full'));
    intro?.remove();panel.append(footer,resizeHandle);
    style.textContent += `
#local-pixai-queue:not([data-minimized="true"]){width:min(920px,calc(100vw - 24px));height:min(700px,calc(100vh - 24px));max-height:none;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:16px;background:#222529}
#local-pixai-queue [hidden]{display:none!important}
#local-pixai-queue [data-header]{position:static;height:54px;margin:0;padding:12px 16px;flex:none;border-bottom:1px solid #41474f}
#local-pixai-queue [data-message]{position:static;flex:none;max-height:56px;overflow:auto;margin:8px 12px;padding:6px 10px;font-size:13px}
#local-pixai-queue .pq-workspace{flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-presets{height:100%;display:flex;flex-direction:column}
#local-pixai-queue .pq-tabs{display:flex;gap:2px;overflow:auto;padding:0 12px;border-bottom:1px solid #41474f;flex:none}
#local-pixai-queue .pq-tabs button{background:transparent;border:0;border-radius:0;margin:0;padding:10px 12px;white-space:nowrap;font-size:14px;color:#bbc3cc;border-bottom:2px solid transparent}
#local-pixai-queue .pq-tabs button[aria-selected="true"]{color:#e6f2fc;background:#29343d;border-bottom-color:#94bedf}
#local-pixai-queue .pq-pages{flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-preset-body{height:100%;padding:14px;overflow:auto}
#local-pixai-queue .pq-preset-body[data-page="chunks"],#local-pixai-queue .pq-preset-body[data-page="characters"]{display:flex;flex-direction:column;overflow:hidden;padding:0}
#local-pixai-queue .pq-library-layout{display:grid;grid-template-columns:260px minmax(0,1fr);height:100%;flex:1;min-height:0}
#local-pixai-queue .pq-with-folders{grid-template-columns:150px 270px minmax(0,1fr)}
#local-pixai-queue .pq-library-browse{display:flex;flex-direction:column;padding:12px;min-width:0;min-height:0;overflow:hidden;background:#1d2024;border-right:1px solid #41474f}
#local-pixai-queue .pq-library-editor{padding:14px;min-width:0;min-height:0;overflow:auto}
#local-pixai-queue .pq-library-editor>strong{display:block;margin-bottom:10px;font-size:15px}
#local-pixai-queue .pq-folder-rail{padding:14px 8px;min-width:0;overflow:auto;background:#181a1d;border-right:1px solid #41474f}
#local-pixai-queue .pq-folder-rail>strong{display:block;margin:0 8px 10px;color:#bbc3cc;font-size:13px}
#local-pixai-queue .pq-folder-buttons button{display:block;width:100%;text-align:left;margin:2px 0;border:0;background:transparent;overflow-wrap:anywhere;font-size:13px;padding:8px}
#local-pixai-queue .pq-folder-buttons button[aria-pressed="true"]{background:#30363c;color:#e6f2fc}
#local-pixai-queue .pq-folder-rail details{margin-top:20px}
#local-pixai-queue .pq-folder-rail .pq-actions button{font-size:12px}
#local-pixai-queue .pq-presets .pq-library-browse .pq-chunk-list,#local-pixai-queue .pq-saved-list{flex:1;min-height:0;max-height:none;overflow:auto;border:0;border-radius:0;margin:8px -4px}
#local-pixai-queue .pq-presets .pq-manager-row{border-top:0;border-bottom:1px solid #41474f;padding:10px 8px}
#local-pixai-queue .pq-presets .pq-manager-row small{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-height:42px;font-size:13px}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{font-size:14px}
#local-pixai-queue .pq-presets .pq-chunk-row-head input[type="checkbox"]{width:15px;height:15px;flex:none;margin:0;padding:0;accent-color:#94bedf}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-drag-handle{flex:none;width:20px;min-height:28px;margin:0;padding:0;border:0;background:transparent;font-size:19px;cursor:grab;color:#b6c1cc}
#local-pixai-queue .pq-presets .pq-drag-handle:active{cursor:grabbing;transform:none}
#local-pixai-queue .pq-presets .pq-manager-row[data-managed="true"]{background:#29343d}
#local-pixai-queue .pq-presets .pq-manager-row[data-chunk-dragging="true"]{opacity:.5}
#local-pixai-queue .pq-presets .pq-manager-row[data-drop-position="before"]{box-shadow:inset 0 3px 0 #acd1ed}
#local-pixai-queue .pq-presets .pq-manager-row[data-drop-position="after"]{box-shadow:inset 0 -3px 0 #acd1ed}
#local-pixai-queue .pq-presets [data-drop-active="true"]{outline:2px dashed #acd1ed;outline-offset:-3px;background:#39434d}
#local-pixai-queue .pq-chunk-management{flex:none;padding:8px;border:1px solid #627d91;border-radius:8px;background:#29343d;margin:4px 0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:5px 0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions button{padding:6px 3px;white-space:nowrap}
#local-pixai-queue .pq-bulk-move{display:flex;gap:6px;align-items:flex-end}
#local-pixai-queue .pq-bulk-move label{flex:1;min-width:0;margin:0}
#local-pixai-queue .pq-bulk-move button{flex:none;margin:0}
#local-pixai-queue .pq-saved-card{width:100%;display:block;text-align:left;padding:12px;margin:0 0 6px;background:transparent;border:1px solid transparent;font-weight:600;overflow-wrap:anywhere}
#local-pixai-queue .pq-saved-card small{font-weight:400;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px}
#local-pixai-queue .pq-saved-card[aria-pressed="true"]{background:#30363c;border-color:#759bb8}
#local-pixai-queue .pq-presets label{font-size:13px;margin:4px 0}
#local-pixai-queue .pq-actions [data-action-message]{order:1;flex-basis:100%;font-size:12px;margin:3px 0;padding:4px 8px}
#local-pixai-queue .pq-library-editor input,#local-pixai-queue .pq-library-editor textarea{margin:3px 0}
#local-pixai-queue .pq-library-editor textarea{min-height:76px;height:76px}
#local-pixai-queue .pq-library-editor textarea[aria-label$="프롬프트"]{min-height:120px;height:120px}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:grid;grid-template-columns:270px minmax(0,1fr);padding:0;overflow:hidden}
#local-pixai-queue .pq-lora{display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:0 12px}
#local-pixai-queue .pq-lora>:nth-child(n+3){grid-column:1 / -1}
#local-pixai-queue .pq-compose-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);height:100%;gap:20px}
#local-pixai-queue .pq-compose-choices{display:flex;flex-direction:column;min-height:0;min-width:0}
#local-pixai-queue .pq-compose-choices>.pq-chunk-list{flex:1;min-height:120px;max-height:none}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks{max-height:96px;overflow:auto;flex:none}
#local-pixai-queue .pq-compose-review{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;padding-right:4px}
#local-pixai-queue .pq-compose-summary{flex:1;min-height:0;overflow:auto;margin-bottom:8px;padding-right:4px}
#local-pixai-queue .pq-compose-review>button{flex:none;align-self:flex-start}
#local-pixai-queue .pq-compose-review>button:last-child{align-self:stretch}
#local-pixai-queue .pq-compose-review .pq-preview{flex:none;max-height:140px;min-height:100px;background:#181a1d;padding:12px;border:1px solid #41474f;border-radius:8px;font-size:13px}
#local-pixai-queue .pq-reservation-list{max-height:210px;overflow:auto;margin:6px 0}
#local-pixai-queue .pq-compose-review .pq-reservation{margin:8px 0}
#local-pixai-queue .pq-presets .pq-chunk-option{padding:10px}
#local-pixai-queue .pq-footer{display:flex;align-items:center;gap:6px;padding:9px 14px;border-top:1px solid #41474f;flex:none;background:#181a1d}
#local-pixai-queue .pq-footer>[data-queue-counts]{margin-right:auto}
#local-pixai-queue .pq-footer button{margin:0;white-space:nowrap}
#local-pixai-queue [data-jobs]{max-height:none;overflow:visible}
#local-pixai-queue h3{font-size:15px;margin:0 0 12px}
#local-pixai-queue .pq-queue-content{max-width:960px;margin:auto}
#local-pixai-queue .pq-settings-content{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:0 32px;max-width:1080px;margin:auto;align-items:start}
#local-pixai-queue .pq-settings-column{min-width:0}
#local-pixai-queue .pq-settings-column h3:not(:first-child){margin-top:24px}
#local-pixai-queue .pq-note{margin:4px 0 10px}
#local-pixai-queue .pq-note>summary{cursor:pointer;font-size:12px;color:#a3abb5;list-style:none}
#local-pixai-queue .pq-note>summary::-webkit-details-marker{display:none}
#local-pixai-queue .pq-note>summary::before{content:"ⓘ ";}
#local-pixai-queue .pq-note[open]>summary{color:#c9d1d9}
#local-pixai-queue .pq-note>small{display:block;margin:4px 0 0 18px}
#local-pixai-queue [data-go-compose]{display:block;margin:10px auto 4px}
#local-pixai-queue .pq-library-mode{display:none}
#local-pixai-queue .pq-library-mode button[aria-pressed="true"]{border-color:#94bedf;background:#39434d}
#local-pixai-queue button:not(:disabled):active{transform:scale(.98)}
@media (max-width:760px){#local-pixai-queue .pq-with-folders{grid-template-columns:125px 220px minmax(0,1fr)}#local-pixai-queue .pq-tabs button{padding:9px 10px;font-size:13px}}
@media (max-width:620px){
#local-pixai-queue [data-header]{padding:10px 12px;height:48px}#local-pixai-queue [data-drag-handle]{font-size:15px}
#local-pixai-queue .pq-library-mode{display:flex;gap:6px;padding:5px 10px;border-bottom:1px solid #41474f;flex:none}
#local-pixai-queue .pq-library-layout{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-with-folders{grid-template-columns:110px minmax(0,1fr)}
#local-pixai-queue [data-library-mode="browse"] .pq-library-editor{display:none}#local-pixai-queue [data-library-mode="edit"] .pq-library-browse,#local-pixai-queue [data-library-mode="edit"] .pq-folder-rail{display:none}
#local-pixai-queue [data-library-mode="edit"] .pq-library-layout{grid-template-columns:minmax(0,1fr)}
#local-pixai-queue .pq-compose-layout{display:block;height:auto}#local-pixai-queue .pq-compose-choices>.pq-chunk-list{max-height:210px;flex:none}#local-pixai-queue .pq-compose-review{display:block;margin-top:16px;overflow:visible}#local-pixai-queue .pq-reservation-list{max-height:240px}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:flex;flex-direction:column;overflow:hidden}#local-pixai-queue [data-page="presets"] .pq-library-browse,#local-pixai-queue [data-page="presets"] .pq-library-editor{flex:1;min-height:0;overflow:auto}
#local-pixai-queue .pq-footer{padding:8px;gap:4px}#local-pixai-queue .pq-footer button{padding:7px;font-size:12px}
}
@media (prefers-reduced-motion:reduce){#local-pixai-queue button:not(:disabled):active{transform:none}}
`;
    style.textContent += `
#local-pixai-queue .pq-icon{width:20px;height:20px;flex:none;order:-1;pointer-events:none;color:inherit}
#local-pixai-queue button[data-icon]{display:inline-flex;align-items:center;justify-content:center;gap:6px}
#local-pixai-queue .pq-tabs button[data-icon]{gap:7px}
#local-pixai-queue .pq-button-picker{min-width:0;margin:5px 0}
#local-pixai-queue .pq-button-picker>strong{display:block;font-size:13px;color:#bbc3cc;margin-bottom:5px;font-weight:500}
#local-pixai-queue .pq-choice-list{height:88px;min-height:54px;max-height:220px;overflow:auto;resize:vertical;border:1px solid #41474f;border-radius:6px;background:#181a1d;padding:3px}
#local-pixai-queue .pq-choice-list button[data-icon]{display:flex;justify-content:flex-start;text-align:left;width:100%;min-height:32px;padding:6px 8px;margin:1px 0;border:1px solid transparent;background:transparent;white-space:normal;overflow-wrap:anywhere;line-height:1.35}
#local-pixai-queue .pq-choice-list button[aria-pressed="true"]{background:#29343d;border-color:#627d91;color:#edf1f5}
#local-pixai-queue .pq-folder-buttons button[data-icon]{display:flex;justify-content:flex-start}
#local-pixai-queue .pq-folder-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#local-pixai-queue .pq-folder-count{flex:none;white-space:nowrap;font-size:12px}
#local-pixai-queue .pq-quick-folder>button{width:100%;justify-content:flex-start;font-size:13px;padding:5px 8px;background:transparent;border-style:dashed}
#local-pixai-queue .pq-quick-folder-form{padding:6px 0}
#local-pixai-queue .pq-quick-folder-form .pq-actions{display:flex;flex-wrap:wrap}
#local-pixai-queue .pq-quick-folder-form .pq-actions button{white-space:normal}
#local-pixai-queue .pq-resizable-layout{display:flex;gap:0;min-width:0;min-height:0;height:100%;flex:1;overflow:hidden}
#local-pixai-queue .pq-resizable-layout>.pq-library-browse,#local-pixai-queue .pq-resizable-layout>.pq-library-editor,#local-pixai-queue .pq-resizable-layout>.pq-folder-rail{height:100%;min-width:0;min-height:0;border-right:0}
#local-pixai-queue .pq-pane-handle{width:8px;flex:0 0 8px;position:relative;cursor:col-resize;touch-action:none;background:#181a1d;outline-offset:-2px}
#local-pixai-queue .pq-pane-handle:before{content:'';position:absolute;left:3px;top:0;bottom:0;width:1px;background:#41474f}
#local-pixai-queue .pq-pane-handle:after{content:'';position:absolute;left:2px;top:calc(50% - 14px);width:3px;height:28px;border-radius:2px;background:#627d91}
#local-pixai-queue .pq-pane-handle:focus-visible{outline:2px solid #acd1ed}
#local-pixai-queue .pq-resizable-layout[data-resizing="true"]{user-select:none;cursor:col-resize}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:flex;flex-direction:column;padding:0}
#local-pixai-queue .pq-compose-choices{padding-right:12px;overflow:auto}
#local-pixai-queue .pq-compose-review{padding-left:12px}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:78px}
#local-pixai-queue .pq-choice-filters{align-items:end}
#local-pixai-queue .pq-choice-filters .pq-choice-list{height:66px}
#local-pixai-queue .pq-chunk-management{display:grid;grid-template-columns:minmax(110px,.6fr) minmax(220px,1fr) minmax(260px,1.4fr);align-items:center;gap:12px;flex:none;max-height:230px;overflow:auto;margin:0;padding:8px 12px;border-width:1px 0 0;border-radius:0;background:#252a2f}
#local-pixai-queue .pq-chunk-management>[role="status"]{font-size:13px}
#local-pixai-queue .pq-chunk-management .pq-move-destination .pq-choice-list{height:66px}
#local-pixai-queue .pq-chunk-management .pq-actions button{min-width:0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-quick-folder-form .pq-actions{display:flex}
#local-pixai-queue .pq-presets .pq-bulk-move{align-items:center;min-width:0}
#local-pixai-queue .pq-bulk-move>.pq-button-picker{flex:1}
#local-pixai-queue .pq-window-resize{position:absolute;right:3px;bottom:3px;width:23px;height:23px;display:flex;align-items:center;justify-content:center;color:#b6c1cc;cursor:nwse-resize;touch-action:none;border-radius:3px}
#local-pixai-queue .pq-window-resize .pq-icon{width:16px;height:16px}
#local-pixai-queue .pq-footer{padding-right:32px}
#local-pixai-queue[data-minimized="true"]{width:52px!important;height:52px!important}
@media (hover:hover) and (pointer:fine){#local-pixai-queue .pq-pane-handle:hover:after,#local-pixai-queue [data-resizing="true"]>.pq-pane-handle:after{background:#94bedf}#local-pixai-queue .pq-window-resize:hover{background:#29343d;color:#acd1ed}}
@media (max-width:760px){#local-pixai-queue .pq-chunk-management{grid-template-columns:120px minmax(0,1fr)}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:1/-1}}
@media (max-width:620px){#local-pixai-queue .pq-pane-handle{display:none}#local-pixai-queue .pq-resizable-layout{display:grid;grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-resizable-layout.pq-with-folders{grid-template-columns:95px minmax(0,1fr)}#local-pixai-queue [data-library-mode="edit"] .pq-resizable-layout{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-resizable-layout.pq-compose-layout{display:block;overflow:auto}#local-pixai-queue .pq-compose-choices{overflow:visible;padding-right:0}#local-pixai-queue .pq-compose-review{padding-left:0}#local-pixai-queue .pq-footer{padding-right:28px}#local-pixai-queue .pq-chunk-management{max-height:220px;grid-template-columns:minmax(0,1fr);gap:4px}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:auto}#local-pixai-queue .pq-tabs button{gap:5px;padding:9px 10px}#local-pixai-queue .pq-choice-filters{display:block}}
@media (max-width:620px){#local-pixai-queue .pq-resizable-layout.pq-with-folders{grid-template-columns:110px minmax(0,1fr)}#local-pixai-queue [data-library-mode="edit"] .pq-resizable-layout.pq-with-folders{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-folder-buttons button[data-icon]{padding:8px 4px;gap:4px}#local-pixai-queue .pq-folder-buttons .pq-icon{width:16px;height:16px}#local-pixai-queue .pq-folder-count{display:none}#local-pixai-queue .pq-chunk-management{grid-template-columns:50px minmax(0,1fr);column-gap:6px}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:1/-1}#local-pixai-queue .pq-chunk-management .pq-move-destination .pq-choice-list{height:54px}#local-pixai-queue .pq-chunk-management .pq-actions button{padding:6px 3px}#local-pixai-queue .pq-chunk-management .pq-actions .pq-icon{width:16px;height:16px}}
`;
    panel.append(node('style',`
#local-pixai-queue{--pq-bg:#16181b;--pq-surface:#1d2024;--pq-raised:#25292e;--pq-hover:#2d3238;--pq-line:#363c44;--pq-text:#e7e9ec;--pq-muted:#a3abb5;--pq-accent:#4fb8a8;--pq-accent-soft:rgba(79,184,168,.16);--pq-manage:#e2b54f;container:pqwin/inline-size;color:var(--pq-text);font:14px/1.45 system-ui,"Malgun Gothic",sans-serif}
#local-pixai-queue:not([data-minimized="true"]){width:min(1180px,calc(100vw - 24px));height:min(786px,calc(100vh - 24px));background:var(--pq-bg);border-color:#4a525c;border-radius:12px}
#local-pixai-queue [data-header]{height:44px;background:var(--pq-bg);padding:8px 14px;border-color:var(--pq-line)}
#local-pixai-queue h2{font-size:15px}#local-pixai-queue small{color:var(--pq-muted);font-size:12px}
#local-pixai-queue :is(button,input,textarea,select){font-size:14px;border-color:#4a525c;background:var(--pq-raised);color:var(--pq-text);min-width:0}
#local-pixai-queue button{min-height:34px}#local-pixai-queue button:not(:disabled):hover{background:var(--pq-hover);border-color:#6a747f}
#local-pixai-queue :is(button,input,textarea,select,summary):focus-visible{outline:2px solid var(--pq-accent);outline-offset:1px}
#local-pixai-queue input[type="checkbox"]{accent-color:var(--pq-accent)}
#local-pixai-queue [data-primary]{background:var(--pq-accent);border-color:var(--pq-accent);color:#0d2723;font-weight:650}
#local-pixai-queue [data-primary]:not(:disabled):hover{background:#75ccbe;border-color:#75ccbe;color:#0d2723}
#local-pixai-queue [data-message]{background:var(--pq-surface);border-color:var(--pq-line);margin:6px 12px;max-height:48px;font-size:12px}
#local-pixai-queue [data-message]:empty{display:none}
#local-pixai-queue [data-toast]{position:absolute;bottom:112px;left:14px;right:14px;z-index:8;border:1px solid var(--pq-accent);border-radius:8px;background:#20312e;box-shadow:0 6px 24px #0006;padding:9px 12px;max-height:108px;overflow:auto;white-space:pre-wrap;font-size:13px}
#local-pixai-queue .pq-tabs{background:var(--pq-bg);border-color:var(--pq-line)}
#local-pixai-queue .pq-tabs button[aria-selected="true"]{background:transparent;color:var(--pq-text);border-bottom-color:var(--pq-accent)}
#local-pixai-queue .pq-presets .pq-preset-body[data-page="library"]{display:flex;flex-direction:column;overflow:hidden;padding:0}
#local-pixai-queue .pq-library-tabs{display:flex;gap:6px;flex:none;padding:8px 10px;border-bottom:1px solid var(--pq-line);overflow:auto}
#local-pixai-queue .pq-library-tabs button{white-space:nowrap;margin:0;background:transparent;min-height:32px}
#local-pixai-queue .pq-library-tabs button[aria-selected="true"]{background:var(--pq-raised);border-color:#79818b}
#local-pixai-queue [data-page="library"]>.pq-preset-body{flex:1;height:auto;min-height:0}
#local-pixai-queue .pq-inline-library{display:flex;flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-inline-library>.pq-library-browse{flex:1;width:100%;padding:12px 14px;border:0;background:var(--pq-bg)}
#local-pixai-queue .pq-inline-library .pq-library-editor{display:block;overflow:visible;padding:12px;border:1px solid #79818b;border-radius:8px;background:var(--pq-surface);margin:8px 0}
#local-pixai-queue .pq-presets [data-page="chunks"] .pq-library-editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 12px}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>strong,#local-pixai-queue [data-page="chunks"] .pq-library-editor>.pq-actions{grid-column:1/-1}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>.pq-button-picker .pq-choice-list{height:48px;min-height:36px}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>label{min-width:0;margin:0}
#local-pixai-queue .pq-presets .pq-inline-library .pq-library-editor textarea{height:90px;min-height:70px}
#local-pixai-queue .pq-library-mode{display:none}
#local-pixai-queue .pq-presets .pq-folder-group{border:1px solid var(--pq-line);border-radius:7px;overflow:hidden;margin:0 0 7px;background:var(--pq-bg)}
#local-pixai-queue .pq-presets .pq-folder-group summary{padding:7px 9px;background:var(--pq-surface);font-size:13px;line-height:1.5;cursor:pointer}
#local-pixai-queue .pq-folder-title{display:inline-block;max-width:calc(100% - 45px);overflow-wrap:anywhere;vertical-align:middle}
#local-pixai-queue .pq-folder-group summary button{float:right;width:30px;padding:0;min-height:28px;margin:-2px 0 0;background:transparent}
#local-pixai-queue .pq-presets .pq-manager-row{padding:7px 9px;background:transparent;border-left:0;border-color:var(--pq-line)}
#local-pixai-queue .pq-presets .pq-manager-row[data-selected="true"]{background:var(--pq-surface)}
#local-pixai-queue .pq-presets .pq-manager-row[data-managed="true"]{background:rgba(226,181,79,.14)}
#local-pixai-queue .pq-presets .pq-chunk-row-head input[type="checkbox"]{accent-color:var(--pq-manage)}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{font-size:14px;white-space:normal;text-align:left}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions button{min-height:30px;width:30px}
#local-pixai-queue .pq-saved-card{background:var(--pq-surface);border-color:var(--pq-line);padding:10px;text-align:left}
#local-pixai-queue .pq-saved-card[aria-pressed="true"]{border-color:#79818b;background:var(--pq-raised)}
#local-pixai-queue .pq-preset-card{margin-bottom:7px}#local-pixai-queue .pq-preset-card>.pq-saved-card{margin:0}
#local-pixai-queue .pq-presets label,#local-pixai-queue .pq-presets button{font-size:14px}
#local-pixai-queue .pq-presets .pq-chunk-management{background:#2d291f;border-color:#6c5b35;padding:7px 12px;gap:8px;max-height:180px}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-choice-list{height:48px;min-height:36px}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions{display:flex;flex-wrap:wrap}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions button{flex:1;min-height:34px;white-space:normal}
#local-pixai-queue .pq-presets [data-page="compose"]{display:flex;flex-direction:column;overflow:hidden;padding:0;min-height:0}
#local-pixai-queue .pq-compose-layout{display:flex;min-height:0;flex:1;gap:0;height:auto}
#local-pixai-queue .pq-compose-layout>div:not(.pq-pane-handle){padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0;min-height:0;overflow:auto;height:100%}
#local-pixai-queue .pq-presets .pq-compose-choices>.pq-chunk-list{flex:1;min-height:130px;max-height:none;border:0;margin:0;overflow:auto}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks{font-size:12px;padding:5px 8px;border:0;background:var(--pq-accent-soft);max-height:70px}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks small{display:none}
#local-pixai-queue .pq-choice-filters label{margin:0}#local-pixai-queue .pq-choice-filters input{margin:0}
#local-pixai-queue .pq-choice-list{background:var(--pq-surface);border-color:var(--pq-line)}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:85px;min-height:40px}
#local-pixai-queue .pq-choice-list button[aria-pressed="true"]{background:var(--pq-accent-soft);border-color:var(--pq-accent);color:var(--pq-text)}
#local-pixai-queue .pq-presets .pq-chunk-option{padding:7px 9px;align-items:center;font-size:14px;border-color:var(--pq-line)}
#local-pixai-queue .pq-selection-number{flex:none!important;min-width:22px;text-align:center;font-size:12px;color:var(--pq-accent)}
#local-pixai-queue .pq-sequence-list{flex:1;min-height:120px;overflow:auto}
#local-pixai-queue .pq-fixed-material{padding:7px 9px;border-left:3px solid #76889e;background:#242a31;margin-bottom:5px}
#local-pixai-queue .pq-fixed-material:nth-child(2){border-color:var(--pq-manage);background:#302b20}
#local-pixai-queue .pq-fixed-material:nth-child(3){border-color:#6fc47c;background:#202d25}
#local-pixai-queue .pq-fixed-material strong{font-size:12px}#local-pixai-queue .pq-fixed-material small{max-height:50px;overflow:auto;overflow-wrap:anywhere}
#local-pixai-queue .pq-recipe-row{display:flex;align-items:center;gap:5px;border:1px solid var(--pq-line);border-left:3px solid var(--pq-accent);border-radius:6px;padding:6px;margin-bottom:5px;background:var(--pq-accent-soft)}
#local-pixai-queue .pq-recipe-row>button{padding:0;width:24px;margin:0;border:0;background:transparent;cursor:grab;flex:none}
#local-pixai-queue .pq-recipe-title{flex:1;min-width:0;overflow-wrap:anywhere}#local-pixai-queue .pq-recipe-title small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#local-pixai-queue .pq-recipe-row .pq-actions{flex:none;gap:2px;margin:0}#local-pixai-queue .pq-recipe-row .pq-actions button{width:25px;padding:0;font-size:15px}
#local-pixai-queue [data-recipe-material][data-drop-position="before"]{box-shadow:inset 0 3px var(--pq-accent)}#local-pixai-queue [data-recipe-material][data-drop-position="after"]{box-shadow:inset 0 -3px var(--pq-accent)}
#local-pixai-queue .pq-compose-review .pq-preview{max-height:160px;min-height:85px;overflow:auto;border-color:var(--pq-line);background:var(--pq-surface);font-size:13px;margin:0;padding:10px;resize:vertical}
#local-pixai-queue .pq-missing-notice{flex:none;max-height:120px;overflow:auto;border:1px solid var(--pq-manage);background:#2d291f;padding:8px;border-radius:7px;font-size:13px}
#local-pixai-queue .pq-reserve-actions{display:flex;gap:5px}#local-pixai-queue .pq-reserve-actions>button:first-child{flex:1}
#local-pixai-queue .pq-reserve-actions button{margin:0}
#local-pixai-queue .pq-schedule-tabs{display:flex;gap:4px;flex:none;overflow:auto;padding-top:7px;border-top:1px solid var(--pq-line)}
#local-pixai-queue .pq-schedule-tabs button{margin:0;flex:1;white-space:nowrap;padding:6px 8px;font-size:13px}
#local-pixai-queue .pq-schedule-tabs button[aria-pressed="true"]{border-color:var(--pq-accent);background:var(--pq-accent-soft)}
#local-pixai-queue .pq-reservation-list,#local-pixai-queue .pq-history-list{flex:1;min-height:0;max-height:none;overflow:auto;margin:0}
#local-pixai-queue .pq-presets .pq-reservation,#local-pixai-queue .pq-history-card{padding:9px;border:1px solid var(--pq-line);border-radius:7px;background:var(--pq-surface);margin:0 0 7px;overflow-wrap:anywhere}
#local-pixai-queue .pq-reservation strong,#local-pixai-queue .pq-history-card strong{display:block;font-size:14px}
#local-pixai-queue .pq-registration-bar{display:flex;align-items:center;gap:12px;justify-content:space-between;border-top:1px solid var(--pq-line);padding:8px 12px;flex:none;background:var(--pq-surface)}
#local-pixai-queue .pq-registration-bar button{margin:0;font-size:13px}#local-pixai-queue .pq-registration-bar span{font-size:12px;color:var(--pq-muted)}
#local-pixai-queue .pq-footer{background:var(--pq-bg);border-color:var(--pq-line)}
#local-pixai-queue .pq-job-menu{display:inline-block;margin:4px 0;border:0;position:relative}#local-pixai-queue .pq-job-menu summary{cursor:pointer;font-size:22px;padding:0 10px;list-style:none}
#local-pixai-queue *{scrollbar-width:thin;scrollbar-color:#4a525c #1d2024}#local-pixai-queue *::-webkit-scrollbar{width:7px;height:7px}#local-pixai-queue *::-webkit-scrollbar-thumb{background:#4a525c;border-radius:4px}#local-pixai-queue *::-webkit-scrollbar-track{background:#1d2024}
#local-pixai-queue .pq-job-timeline{display:flex;gap:6px;margin:7px 0;flex-wrap:wrap;font-size:12px}#local-pixai-queue .pq-job-timeline span{padding:3px 7px;border-radius:5px;background:var(--pq-raised)}#local-pixai-queue .pq-job-timeline [data-complete="true"]{color:var(--pq-accent)}
#local-pixai-queue .pq-job-detail{margin:7px 0}#local-pixai-queue .pq-job-detail summary{cursor:pointer;font-size:13px}#local-pixai-queue .pq-job-prompt{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:var(--pq-surface);border-radius:5px;font-size:13px;max-height:180px;overflow:auto}
#local-pixai-queue [data-queue-counts]{font-size:12px;color:var(--pq-muted)}
#local-pixai-queue .pq-pane-handle{background:var(--pq-bg)}#local-pixai-queue .pq-pane-handle:before{background:var(--pq-line)}#local-pixai-queue .pq-pane-handle:after{background:#4a525c}
#local-pixai-queue .pq-compose-mode{display:none}
@container pqwin (max-width:760px){#local-pixai-queue .pq-settings-content{grid-template-columns:minmax(0,1fr)}
#local-pixai-queue .pq-compose-mode{display:flex;gap:5px;padding:6px 10px;flex:none;border-bottom:1px solid var(--pq-line)}
#local-pixai-queue .pq-compose-mode button{flex:1;white-space:nowrap;margin:0;padding:5px;font-size:13px}
#local-pixai-queue .pq-compose-mode button[aria-pressed="true"]{background:var(--pq-accent-soft);border-color:var(--pq-accent)}
#local-pixai-queue .pq-compose-layout{display:flex!important;overflow:hidden;min-height:0}
#local-pixai-queue .pq-compose-layout>.pq-pane-handle{display:none}
#local-pixai-queue .pq-compose-layout>div:not(.pq-pane-handle){flex:1!important;min-height:0;margin:0;padding:10px;width:100%;height:100%;overflow:auto}
#local-pixai-queue .pq-compose-layout>.pq-compose-choices{gap:4px;overflow:auto}
#local-pixai-queue .pq-compose-choices>strong{display:none}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:58px}
#local-pixai-queue .pq-presets .pq-compose-choices>.pq-chunk-list{min-height:160px}
#local-pixai-queue [data-compose-mode="choices"] .pq-compose-review,#local-pixai-queue [data-compose-mode="choices"] .pq-compose-schedule,#local-pixai-queue [data-compose-mode="review"] .pq-compose-choices,#local-pixai-queue [data-compose-mode="review"] .pq-compose-schedule,#local-pixai-queue [data-compose-mode="schedule"] .pq-compose-choices,#local-pixai-queue [data-compose-mode="schedule"] .pq-compose-review{display:none!important}
#local-pixai-queue .pq-resizable-layout:not(.pq-compose-layout){display:flex;flex-direction:column}
#local-pixai-queue .pq-resizable-layout:not(.pq-compose-layout)>.pq-pane-handle{display:none}
#local-pixai-queue [data-page="characters"] .pq-resizable-layout>div:not(.pq-pane-handle){flex:1!important;width:100%}
#local-pixai-queue .pq-presets .pq-inline-library .pq-library-editor{display:block}#local-pixai-queue .pq-presets [data-page="chunks"] .pq-library-editor{display:grid}
#local-pixai-queue .pq-inline-library>.pq-library-browse{display:flex!important;padding:8px}
#local-pixai-queue .pq-presets .pq-chunk-management{display:flex;flex-wrap:wrap;max-height:155px;gap:4px}
#local-pixai-queue .pq-chunk-management>.pq-bulk-move{width:100%}
#local-pixai-queue .pq-tabs button{padding:8px;gap:5px;font-size:13px}
#local-pixai-queue [data-queue-counts]{display:none}
#local-pixai-queue .pq-library-tabs{padding:6px;gap:4px}#local-pixai-queue .pq-library-tabs button{padding:5px 8px;font-size:13px}
#local-pixai-queue .pq-registration-bar{gap:6px;padding:6px 8px}#local-pixai-queue .pq-registration-bar button{font-size:12px;padding:6px}
}
`));
    style.textContent+='#local-pixai-queue label.pq-check-label{display:flex;align-items:flex-start;justify-content:flex-start;gap:9px;text-align:left;cursor:pointer;max-width:none;margin:10px 0}#local-pixai-queue label.pq-check-label>input[type="checkbox"]{width:17px;height:17px;flex:0 0 17px;margin:3px 0 0;padding:0;align-self:flex-start}#local-pixai-queue .pq-queue-toolbar button[aria-pressed="true"]{border-color:#62bea8;background:#21483f}#local-pixai-queue .pq-queue-confirm{padding:10px;border:1px solid #c9a469;border-radius:8px;margin:8px 0}#local-pixai-queue label.pq-check-label>strong{flex:1;min-width:0;overflow-wrap:anywhere}#local-pixai-queue label.pq-check-label>span{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere}';
    document.body.append(panel);
    try { load(); } catch(error) { message=`대기열 읽기 실패: ${error.message}\n프리셋 읽기·편집은 사용할 수 있습니다. 대기열 원본은 유지했습니다.`; }
    render();
    panelDrag=bindPanelDrag(panel, dragHandle, {
      launcher, open:() => minimize(false),
      viewport:() => ({width:document.documentElement?.clientWidth || window.innerWidth,height:document.documentElement?.clientHeight || window.innerHeight}),
      load:() => JSON.parse(localStorage.getItem('local.pixai-web-queue.position.v1') || 'null'),
      save:position => localStorage.setItem('local.pixai-web-queue.position.v1', JSON.stringify(position)),
      onResize:action => {
        window.addEventListener('resize', action);
        new ResizeObserver(action).observe(panel);
      }
    });
    bindWindowResize(panel,resizeHandle,{
      viewport:()=>({width:document.documentElement?.clientWidth || window.innerWidth,height:document.documentElement?.clientHeight || window.innerHeight}),
      load:()=>JSON.parse(localStorage.getItem('local.pixai-web-queue.size.v1') || 'null'),
      save:value=>localStorage.setItem('local.pixai-web-queue.size.v1',JSON.stringify(value)),
      onResize:listener=>window.addEventListener('resize',listener)
    });
    if (storage.mode === 'folder' && typeof indexedDB !== 'undefined') folderRestoration=restoreSelectedFolder();
  }
  async function restoreSelectedFolder() {
    const epoch=folderEpoch;restoringFolder=true;render();
    try {
      let record=await folderRecord();
      if (!record || epoch !== folderEpoch) return;
      if (record.kind === 'directory') record={handle:record,token:null};
      if (record.handle?.kind !== 'directory' || typeof record.handle.queryPermission !== 'function' || typeof record.handle.isSameEntry !== 'function' || (record.token != null && (typeof record.token !== 'string' || !record.token))) throw new Error('저장된 폴더 기록의 형식을 확인하지 못했습니다.');
      const permission=await record.handle.queryPermission({mode:'readwrite'});
      if (!['granted','prompt','denied'].includes(permission)) throw new Error('저장 폴더 권한을 확인하지 못했습니다.');
      if (epoch !== folderEpoch) return; // A newer user selection wins.
      rememberedFolder=record;
      if (permission === 'granted') {
        folder=record.handle;folderToken=record.token;
        if (!starting && !settingsBusy && message === storage.message) message=`저장 폴더 자동 연결: ${folder.name}`;
      } else if (!starting && !settingsBusy && message === storage.message) message=`이전 저장 폴더 ${record.handle.name}을 기억하고 있습니다. 설정에서 ‘저장 폴더 권한 허용’을 눌러 주세요.`;
    } catch(error) { if (epoch === folderEpoch && !starting && !settingsBusy && message === storage.message) message=`저장 폴더 기록을 복원하지 못했습니다. 폴더를 선택해 주세요. (${error.message})`; }
    finally { if (epoch === folderEpoch) restoringFolder=false;render(); }
  }
  async function chooseFolder({pickNew=false}={}) {
    if (choosingFolder || running || starting || settingsBusy) return;
    if (!storage.supported) { message = storage.message; render(); return; }
    choosingFolder = true;
    folderEpoch++;restoringFolder=false;
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = true; choose.textContent = storage.mode === 'download' ? '확인 파일 다운로드 중…' : '폴더 선택 중…';
    const notify = text => { message = text; render(); };
    try {
      if (storage.mode === 'download') {
        downloadsReady = false;
        notify('확인 파일 다운로드 중 · 파일이 저장되기 전에는 생성하지 않습니다.');
        await locked(async () => {
          const name = `PixAI_다운로드확인_${Date.now()}.json`;
          await writeNew(name, JSON.stringify({app:'PixAI 웹 대기열', version:'0.10.3-dev.1', probe:true}));
          downloadsReady = true; folderToken = `download:${crypto.randomUUID()}`;
          message = `자동 다운로드 준비 확인 완료: ${name}\n이 파일이 저장된 위치를 확인해 주세요. 이후 다운로드는 브라우저 설정 폴더를 따릅니다. 실행 중 저장 위치를 변경하지 마세요. 부분 저장 재개 시 같은 작업의 원본 전부를 추가 사본으로 저장합니다.`;
          render();
        });
        return;
      }
      const renew=!pickNew && !folder ? rememberedFolder : null;
      let chosen;
      if (renew) {
        if (typeof renew.handle.requestPermission !== 'function') throw new Error('권한 재확인을 지원하지 않습니다. ‘다른 저장 폴더 선택’을 눌러 주세요.');
        notify('기억한 저장 폴더의 권한 확인 중…');
        // Called directly from the user's button gesture; startup only queries.
        if (await renew.handle.requestPermission({mode:'readwrite'}) !== 'granted') throw new Error('저장 폴더 쓰기 권한을 허용하지 않았습니다. 권한 허용 또는 다른 저장 폴더 선택을 눌러 주세요.');
        chosen=renew.handle;
      } else chosen = await pickDirectory(window, notify);
      await locked(async () => {
        const partial = jobs.filter(job => job.saved?.length && !['done','skipped'].includes(job.state));
        let previous = folder ? {handle:folder,token:folderToken} : await folderRecord().catch(() => null);
        if (previous?.kind === 'directory') previous = {handle:previous,token:null}; // 0.1.1 record
        if (partial.some(job => job.folderToken && job.folderToken !== previous?.token)) previous = null;
        const token = renew?.token || (partial.length && previous?.token ? previous.token : crypto.randomUUID());
        const warning = await acceptFolder(chosen, {
          partial:partial.length > 0, previous:previous?.handle,
          remember:() => folderRecord({handle:chosen,token})
        });
        folder = chosen; folderToken = token;
        rememberedFolder={handle:chosen,token};
        for (const job of partial) job.folderToken = token;
        message = warning || `저장 폴더 선택 완료: ${chosen.name}`;
        persist();
      });
    } catch (error) { message = folderError(error); }
    finally { choosingFolder = false; render(); }
  }
  // Official API execution does not take focus from or intercept site input.
  window.addEventListener('storage', event=>{
    // Library edits from another tab are picked up even while this tab runs, so a later commit here cannot overwrite them.
    if (event.key===LIBRARY_KEY && !starting && !settingsBusy) { try {presetEditor?.refresh();} catch {message='프리셋 라이브러리 읽기 실패';render();} }
    if (event.key===KEY && !running && !starting && !settingsBusy) { try {load();render();} catch {message='대기열 읽기 실패';render();} }
  });
  window.addEventListener('beforeunload',event=>{if(running || starting){event.preventDefault();event.returnValue='';}});
  async function folderRecord(value) {
    const db = await new Promise((resolve,reject)=>{
      const open=indexedDB.open('local.pixai-web-queue.folder',1);
      let abandoned=false;
      const timeout=setTimeout(()=>{abandoned=true;reject(new Error('저장 폴더 기록 응답 시간 초과'))},5000);
      open.onupgradeneeded=()=>open.result.createObjectStore('folder');
      open.onsuccess=()=>{clearTimeout(timeout);if(abandoned){open.result.close();return}resolve(open.result)};
      open.onerror=()=>{clearTimeout(timeout);reject(open.error || new Error('저장 폴더 기록을 열 수 없습니다.'))};
      open.onblocked=()=>{clearTimeout(timeout);abandoned=true;reject(new Error('다른 탭이 저장 폴더 기록을 잠그고 있습니다.'))};
    });
    try {
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('folder',value?'readwrite':'readonly');
        const request=value?tx.objectStore('folder').put(value,'selected'):tx.objectStore('folder').get('selected');
        const timeout=setTimeout(()=>{tx.abort();},5000);
        let result;request.onsuccess=()=>{result=request.result};
        tx.oncomplete=()=>{clearTimeout(timeout);resolve(result)};
        tx.onerror=tx.onabort=()=>{clearTimeout(timeout);reject(tx.error || new Error('저장 폴더 기록에 실패했습니다.'))};
      });
    } finally {db.close();}
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
