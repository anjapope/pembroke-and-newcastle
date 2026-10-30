(function () {
  "use strict";

  window.PN_INSTITUTIONS = Object.freeze([
    Object.freeze({
      id: "public-library",
      name: "Public Library",
      annualBudget: 5000,
      requiresDepartment: true,
      collectionLines: Object.freeze([
        ["AF", "Adult Fiction"], ["ANF", "Adult Nonfiction"], ["JF", "Juvenile Fiction"],
        ["JNF", "Juvenile Nonfiction"], ["YA", "Young Adult"], ["REF", "Reference"],
        ["AV", "Audiovisual"], ["LOCAL", "Local History"], ["DIGITAL", "Digital Resources"]
      ].map(([code, label]) => Object.freeze({ code, label }))),
      funds: Object.freeze([
        ["GENERAL", "General Collections"], ["YOUTH", "Youth Services"], ["ADULT", "Adult Services"],
        ["LOCAL", "Local History"], ["DIGITAL", "Digital Resources"]
      ].map(([code, label]) => Object.freeze({ code, label })))
    }),
    Object.freeze({
      id: "academic-library",
      name: "Academic Library",
      annualBudget: 8000,
      requiresDepartment: true,
      collectionLines: Object.freeze([
        ["MONO", "Monographs"], ["REF", "Reference"], ["SERIAL", "Serials"],
        ["ERES", "Electronic Resources"], ["SPEC", "Special Collections"], ["MEDIA", "Media"]
      ].map(([code, label]) => Object.freeze({ code, label }))),
      funds: Object.freeze([
        ["GENERAL", "General Collections"], ["SUBJECT", "Subject Resources"], ["RESEARCH", "Research Support"],
        ["SPECIAL", "Special Collections"], ["ELECTRONIC", "Electronic Resources"]
      ].map(([code, label]) => Object.freeze({ code, label })))
    }),
    Object.freeze({
      id: "archive-special-collections",
      name: "Archive / Special Collections",
      annualBudget: 4000,
      requiresDepartment: false,
      collectionLines: Object.freeze([
        ["MSS", "Manuscripts"], ["PHOTO", "Photographs"], ["AV", "Audiovisual"],
        ["DIG", "Digital Collections"], ["ORAL", "Oral Histories"], ["EPHEM", "Ephemera"], ["RARE", "Rare Books"]
      ].map(([code, label]) => Object.freeze({ code, label }))),
      funds: Object.freeze([
        ["GENERAL", "General Acquisitions"], ["ACCESSION", "Accessioning"], ["PRESERVATION", "Preservation"],
        ["DIGITAL", "Digital Collections"], ["SPECIAL", "Special Collections"]
      ].map(([code, label]) => Object.freeze({ code, label })))
    }),
    Object.freeze({
      id: "museum-cultural-heritage",
      name: "Museum / Cultural Heritage",
      annualBudget: 10000,
      requiresDepartment: true,
      collectionLines: Object.freeze([
        ["ART", "Art"], ["HIST", "Historical Collections"], ["NAT", "Natural History"],
        ["ETHNO", "Ethnographic Collections"], ["DOC", "Documentary Collections"],
        ["DIG", "Digital Collections"], ["EXHIBIT", "Exhibition Resources"]
      ].map(([code, label]) => Object.freeze({ code, label }))),
      funds: Object.freeze([
        ["GENERAL", "General Acquisitions"], ["COLLECTIONS", "Collections"], ["EXHIBITION", "Exhibition"],
        ["EDUCATION", "Education"], ["DIGITAL", "Digital Resources"]
      ].map(([code, label]) => Object.freeze({ code, label })))
    }),
    Object.freeze({
      id: "school-library-media-center",
      name: "School Library / Media Center",
      annualBudget: 3000,
      requiresDepartment: false,
      collectionLines: Object.freeze([
        ["E", "Easy Readers / Picture Books"], ["JF", "Juvenile Fiction"], ["JNF", "Juvenile Nonfiction"],
        ["YA", "Young Adult"], ["REF", "Reference"], ["MEDIA", "Media"], ["DIGITAL", "Digital Resources"]
      ].map(([code, label]) => Object.freeze({ code, label }))),
      funds: Object.freeze([
        ["GENERAL", "General Collections"], ["CURRICULUM", "Curriculum Support"], ["LITERACY", "Literacy"],
        ["MEDIA", "Media Resources"], ["DIGITAL", "Digital Resources"]
      ].map(([code, label]) => Object.freeze({ code, label })))
    })
  ]);
}());
