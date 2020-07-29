# frozen_string_literal: true

# rake data_explorer:list_hidden_queries
desc "Shows a list of hidden queries"
task('data_explorer:list_hidden_queries').clear
task 'data_explorer:list_hidden_queries' => :environment do |t|
  hidden_queries = []
  puts "\nHidden Queries\n\n"

  DataExplorer::Query.all.each do |query|
    hidden_queries.push(query) if query.hidden
  end

  hidden_queries.each do |query|
    puts "Name: #{query.name}"
    puts "Description: #{query.description}"
    puts "ID: #{query.id}\n\n"
  end
end

# rake data_explorer[-1]
# rake data_explorer[1,-2,3,-4,5]
desc "Hides one or multiple queries by ID"
task('data_explorer').clear
task 'data_explorer' => :environment do |t, args|
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts "\nError finding query with id #{id}"
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "\nFound query with id #{id}"
      end

      q.hidden = true
      q.save
      puts "Query no.#{id} is now hidden" if q.hidden
    end
  end
  puts ""
end

# rake data_explorer:unhide_query[-1]
# rake data_explorer:unhide_query[1,-2,3,-4,5]
desc "Unhides one or multiple queries by ID"
task('data_explorer:unhide_query').clear
task 'data_explorer:unhide_query' => :environment do |t, args|
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts "\nError finding query with id #{id}"
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "\nFound query with id #{id}"
      end

      q.hidden = false
      q.save
      puts "Query no.#{id} is now visible" unless q.hidden
    end
  end
  puts ""
end

# rake data_explorer:hard_delete[-1]
# rake data_explorer:hard_delete[1,-2,3,-4,5]
desc "Hard deletes one or multiple queries by ID"
task('data_explorer:hard_delete').clear
task 'data_explorer:hard_delete' => :environment do |t, args|
  args.extras.each do |arg|
    id = arg.to_i

    if DataExplorer.pstore_get("q:#{id}").nil?
      puts "\nError finding query with id #{id}"
    else
      q = DataExplorer::Query.find(id)
      if q
        puts "\nFound query with id #{id}"
      end

      if q.hidden
        DataExplorer.pstore_delete "q:#{id}"
        puts "Query no.#{id} has been deleted"
      else
        puts "Query no.#{id} must be hidden in order to hard delete"
        puts "To hide the query, run: " + "rake data_explorer[#{id}]"
      end
    end
  end
  puts ""
end
