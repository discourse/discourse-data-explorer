# frozen_string_literal: true

desc "Shows a list of hidden queries"
task 'data_explorer:list_hidden_queries' => :environment do |t|
  hidden_queries = []
  puts "-----------------"
  puts "Hidden Queries"
  puts "================="

  DataExplorer::Query.all.each do |query|
    hidden_queries.push(query) if query.hidden
  end

  hidden_queries.each do |query|
    puts "Name: #{query.name}"
    puts "Description: #{query.description}"
    puts "ID: #{query.id}"
    puts "-----------------"
  end
end

desc "Hides a query by one or multiple IDs"
task 'data_explorer' => :environment do |t, args|
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts "-----------------"
      puts "Error finding query with id #{id}"
      puts "-----------------"
    else
      q = DataExplorer::Query.find(id)
      puts "-----------------"
      if q
        puts "Found query with id #{id}"
      end

      q.hidden = true
      q.save
      puts "Query no.#{id} is now hidden" if q.hidden
      puts "-----------------"
    end
  end
end

desc "Unhides a query by one or multiple IDs"
task 'data_explorer:unhide_query' => :environment do |t, args|
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts "-----------------"
      puts "Error finding query with id #{id}"
      puts "-----------------"
    else
      q = DataExplorer::Query.find(id)
      puts "-----------------"
      if q
        puts "Found query with id #{id}"
      end

      q.hidden = false
      q.save
      puts "Query no.#{id} is now visible" unless q.hidden
      puts "-----------------"
    end
  end
end
